const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash'; // Multimodal support for OCR + chat
const GEMINI_MODEL_LEGACY = 'gemini-1.5-flash'; // Fallback for simple tasks or quota issues

/**
 * Sends a POST request to the Gemini API for a given model.
 */
async function postToGemini(model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * Core wrapper that executes a Gemini API call using gemini-2.0-flash first.
 * If a quota (429), access (403), or invalid model error (400) occurs,
 * it automatically falls back to gemini-1.5-flash.
 */
async function callGeminiWithFallback(body) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured in environment variables');
  }

  console.log(`Calling Gemini API using model: ${GEMINI_MODEL}...`);
  let response = await postToGemini(GEMINI_MODEL, body);

  if (!response.ok) {
    const isQuotaOrAccessError = response.status === 429 || response.status === 400 || response.status === 403;
    if (isQuotaOrAccessError) {
      const errorText = await response.clone().text();
      console.warn(`Gemini call with ${GEMINI_MODEL} failed (Status: ${response.status}). Attempting fallback to ${GEMINI_MODEL_LEGACY}... Error detail:`, errorText);
      
      // Fallback to legacy 1.5-flash
      response = await postToGemini(GEMINI_MODEL_LEGACY, body);
      
      if (!response.ok) {
        const errorTextLeg = await response.text();
        throw new Error(`Gemini Fallback Error (${GEMINI_MODEL_LEGACY}): ${response.status} - ${errorTextLeg}`);
      }
      
      console.log(`Successfully completed request using fallback model: ${GEMINI_MODEL_LEGACY}`);
    } else {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response received from Gemini API');
  }

  return text.trim();
}

/**
 * Basic text-only content generation (existing API — unchanged behavior).
 */
export async function generateContent(prompt) {
  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  return callGeminiWithFallback(body);
}

/**
 * Chat-style conversation with system prompt.
 * Used by the Gaudai AI Assistant for contextual conversations.
 * 
 * @param {string} systemPrompt - System instruction for the AI
 * @param {Array<{role: string, text: string}>} messages - Conversation history
 * @returns {Promise<string>} AI response text
 */
export async function chatWithGemini(systemPrompt, messages) {
  // Build contents array from conversation history
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 4096
    }
  };

  return callGeminiWithFallback(body);
}

/**
 * Multimodal image + text processing.
 * Used for OCR of handwritten documents.
 * 
 * @param {string} prompt - Text instruction for processing the image
 * @param {string} imageBase64 - Base64-encoded image data (no data: prefix)
 * @param {string} mimeType - Image MIME type (image/jpeg, image/png, etc.)
 * @returns {Promise<string>} AI response with extracted data
 */
export async function processImageWithGemini(prompt, imageBase64, mimeType) {
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,  // Low temperature for accurate extraction
      topP: 0.8,
      maxOutputTokens: 8192  // Large output for detailed OCR results
    }
  };

  return callGeminiWithFallback(body);
}

/**
 * Categorize expense description using Gemini AI.
 * @param {string} reason - Expense reason description
 * @param {string} lang - Language ('mr' or 'en')
 */
export async function suggestExpenseCategory(reason, lang = 'mr') {
  let prompt;
  if (lang === 'mr') {
    prompt = `हा डेअरी व्यवसायाचा खर्च खालीलपैकी एका वर्गात ठेवा:
इंधन, पगार, पॅकेजिंग, वीज, वाहतूक, देखभाल, साहित्य, मार्केटिंग, इतर

खर्चाचे कारण: ${reason}

फक्त एकच वर्गाचे नाव मराठीत उत्तर द्या. (उदा. "इंधन" किंवा "पगार")`;
  } else {
    prompt = `Categorize this dairy business expense in one word from: 
Fuel, Salary, Packaging, Electricity, Transport, Maintenance, Supplies, Marketing, Other.
Expense reason: ${reason}
Reply with only the category word.`;
  }

  try {
    const result = await generateContent(prompt);
    // Clean up responses like quotes, formatting, or periods
    const category = result.replace(/["'.\s]/g, '');
    return category;
  } catch (error) {
    console.error('Failed to suggest expense category:', error);
    return lang === 'mr' ? 'इतर' : 'Other'; // Fallback
  }
}

/**
 * Generate 5 bullet point business insights using Gemini AI.
 * @param {object} financialData - Aggregated financial metrics
 * @param {string} lang - Language ('mr' or 'en')
 */
export async function generateBusinessInsights(financialData, lang = 'mr') {
  let prompt;
  const dataStr = JSON.stringify(financialData, null, 2);

  if (lang === 'mr') {
    prompt = `खालील डेअरी व्यवसायाच्या डेटावर आधारित 5 महत्त्वाचे व्यावसायिक आणि आर्थिक मुद्दे (business insights) मराठीत सांगा.
प्रत्येक मुद्दा एका ओळीत असावा. फक्त मुद्दे द्या, इतर काही नको. (प्रत्येक मुद्दा बुलेट पॉईंट • ने सुरू करा).

डेटा:
${dataStr}`;
  } else {
    prompt = `Based on the following dairy business financial data, provide exactly 5 key business and financial insights in English.
Each insight should be one line. Output only the bullet points starting with • and nothing else.

Data:
${dataStr}`;
  }

  try {
    const result = await generateContent(prompt);
    // Split into lines and filter bullet points
    const lines = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return lines;
  } catch (error) {
    console.error('Failed to generate insights:', error);
    if (lang === 'mr') {
      return [
        '• उत्पन्न आणि खर्चाचे नियमित पुनरावलोकन करा.',
        '• ग्राहकांकडील थकबाकी वसुलीवर लक्ष केंद्रित करा.',
        '• इंधन आणि वाहतूक खर्चावर नियंत्रण ठेवणे फायदेशीर ठरेल.',
        '• दुधाचे संकलन आणि गुणवत्ता सातत्याने तपासा.',
        '• चालू महिन्यासाठी आर्थिक उद्दिष्टे साध्य करण्यासाठी नियोजन करा.'
      ];
    } else {
      return [
        '• Regularly review revenue and expenses.',
        '• Focus on collecting customer pending dues.',
        '• Control fuel and transport overheads to maximize margins.',
        '• Monitor milk collection volumes and quality parameters.',
        '• Plan carefully to hit this month\'s net profit target.'
      ];
    }
  }
}
