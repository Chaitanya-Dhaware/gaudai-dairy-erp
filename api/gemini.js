/* global process */
import { authenticateRequest } from './_lib/auth.js';

// Maximum payload size matching Vercel Serverless Function request limit (4.5 MB)
const MAX_BODY_BYTES = Math.floor(4.5 * 1024 * 1024);
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests / min / user

// Permitted Gemini models
export const ALLOWED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
]);

// Default model is resolved via GEMINI_MODEL env var if configured.
// NOTE: Verify current Google AI model names and lifecycle status periodically;
// models retired by Google will be rejected by the API.
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

// In-memory sliding rate limiter per user UID (fallback)
const rateLimitMap = new Map();

export function checkRateLimitInMemory(uid) {
  const now = Date.now();
  const record = rateLimitMap.get(uid);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(uid, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * Enforce rate limiting per user UID.
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, uses atomic Redis pipeline.
 * Otherwise falls back to in-memory sliding window (per serverless instance, best-effort).
 */
export async function checkRateLimit(uid, deps = {}) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const fetchImpl = deps.fetch || fetch;
      // Fixed 1-minute window bucket ensures TTL is not indefinitely reset on sustained traffic
      const windowBucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
      const key = `rl:gemini:${uid}:${windowBucket}`;
      const pipelineRes = await fetchImpl(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, 70]
        ])
      });
      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const count = results[0]?.result;
        if (typeof count === 'number') {
          return count <= MAX_REQUESTS_PER_WINDOW;
        }
      }
    } catch {
      // Best-effort fallback to in-memory limiter during Redis outage (documented weaker multi-instance boundary)
    }
  }

  return checkRateLimitInMemory(uid);
}

export function resetRateLimits() {
  rateLimitMap.clear();
}

/**
 * Serverless Gemini AI Proxy Handler
 */
export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Authenticate caller (any authenticated, active user)
  const authResult = await authenticateRequest(req, {}, deps);
  if (authResult.error) {
    return res.status(authResult.error.status).json({ success: false, error: authResult.error.message });
  }

  const user = authResult.user;

  // 2. Enforce per-user rate limiting (Upstash Redis or in-memory fallback)
  const isAllowed = await checkRateLimit(user.uid, deps);
  if (!isAllowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a minute before sending more AI prompts.'
    });
  }

  // 3. Validate payload size against Vercel's 4.5MB ceiling
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large. Maximum allowed size is 4.5MB.'
    });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid request payload. Expected JSON body.' });
  }

  const { contents, system_instruction, generationConfig, model: requestedModel } = body;
  if (!contents || !Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or empty "contents" array in payload.' });
  }

  // 4. Server-side credentials and model resolution
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('Server Configuration Error: GEMINI_API_KEY is missing from environment.');
    return res.status(500).json({ success: false, error: 'AI service is currently not configured.' });
  }

  // Determine model: client requested model or env configuration or default
  const configuredModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const targetModel = requestedModel || configuredModel;

  if (!ALLOWED_GEMINI_MODELS.has(targetModel)) {
    return res.status(400).json({
      success: false,
      error: `Invalid or unsupported AI model: "${targetModel}". Allowed models: ${Array.from(ALLOWED_GEMINI_MODELS).join(', ')}.`
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents,
    ...(system_instruction ? { system_instruction } : {}),
    ...(generationConfig ? { generationConfig } : {})
  };

  try {
    const fetchImpl = deps.fetch || fetch;
    const upstreamRes = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!upstreamRes.ok) {
      let safeMsg = 'AI generation service returned an error.';
      try {
        const errJson = await upstreamRes.json();
        if (errJson?.error?.code === 429) {
          safeMsg = 'AI rate limit or quota exceeded. Please wait a moment and try again.';
        } else if (errJson?.error?.status === 'INVALID_ARGUMENT') {
          safeMsg = 'Invalid request arguments provided to AI service.';
        }
      } catch {
        // Fallback to safeMsg without logging contents or body
      }
      return res.status(upstreamRes.status >= 500 ? 502 : upstreamRes.status).json({
        success: false,
        error: safeMsg
      });
    }

    const data = await upstreamRes.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Gemini upstream network error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to communicate with AI service.' });
  }
}
