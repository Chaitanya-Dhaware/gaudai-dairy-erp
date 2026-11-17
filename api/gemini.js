/* global process */
import { authenticateRequest } from './_lib/auth.js';

const MAX_BODY_BYTES = 1024 * 512; // 512 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests / min / user

// In-memory sliding rate limiter per user UID
const rateLimitMap = new Map();

export function checkRateLimit(uid) {
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

  // 2. Enforce per-user rate limiting
  if (!checkRateLimit(user.uid)) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a minute before sending more AI prompts.'
    });
  }

  // 3. Validate payload size
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ success: false, error: 'Payload Too Large. Maximum allowed size is 512KB.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid request payload. Expected JSON body.' });
  }

  const { contents, system_instruction, generationConfig } = body;
  if (!contents || !Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or empty "contents" array in payload.' });
  }

  // 4. Server-side credentials and model resolution
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('Server Configuration Error: GEMINI_API_KEY is missing from environment.');
    return res.status(500).json({ success: false, error: 'AI service is currently not configured.' });
  }

  // Single configurable model name from env
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents,
    ...(system_instruction ? { system_instruction } : {}),
    ...(generationConfig ? { generationConfig } : {})
  };

  try {
    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      let safeMsg = 'AI generation service returned an error.';
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) {
          safeMsg = parsed.error.message;
        }
      } catch {
        // use fallback safeMsg
      }
      return res.status(upstreamRes.status >= 500 ? 502 : upstreamRes.status).json({
        success: false,
        error: safeMsg
      });
    }

    const data = await upstreamRes.json();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Gemini proxy error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to communicate with AI service.' });
  }
}
