/**
 * Gemini AI Client Module
 *
 * All AI generation and OCR requests are mediated through the secure /api/gemini serverless proxy.
 * No API keys are bundled or exposed in client assets.
 * Automatically downscales and compresses images before sending to stay well within proxy limits.
 */
import { callGemini } from './apiClient';

const MAX_IMAGE_DIMENSION = 1600;
const MAX_ALLOWED_BASE64_BYTES = 4 * 1024 * 1024; // 4 MB

const TOO_LARGE_ERROR_MSG = 'फाइल खूप मोठी आहे. कृपया लहान फाइल निवडा (कमाल 4MB) / File is too large. Please select a smaller file (max 4MB).';

/**
 * Compresses and resizes an image if running in a browser environment.
 * Scales dimensions to MAX_IMAGE_DIMENSION and recompresses as JPEG (quality 0.8).
 *
 * @param {string} base64Data - Raw or data-URL base64 string
 * @param {string} mimeType - e.g. 'image/jpeg' or 'image/png'
 * @returns {Promise<{ data: string, mimeType: string }>} Compressed base64 without prefix
 */
export async function shrinkAndCompressImage(base64Data, mimeType = 'image/jpeg') {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

  // If running outside browser (e.g. Node tests), skip canvas compression
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { data: cleanBase64, mimeType };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ data: cleanBase64, mimeType });
          return;
        }
        // Fill background with white to preserve readability for transparent PNGs converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as compressed JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const outData = compressedDataUrl.replace(/^data:[^;]+;base64,/, '');
        resolve({ data: outData, mimeType: 'image/jpeg' });
      } catch (err) {
        console.warn('Canvas image compression failed, falling back to original image:', err);
        resolve({ data: cleanBase64, mimeType });
      }
    };

    img.onerror = () => {
      // On canvas error, fall back to original clean base64
      resolve({ data: cleanBase64, mimeType });
    };

    img.src = `data:${mimeType};base64,${cleanBase64}`;
  });
}

/**
 * Sends request to /api/gemini proxy and extracts candidates text.
 */
async function callGeminiProxy(body) {
  const res = await callGemini(body);

  if (!res.success) {
    throw new Error(res.error || 'Failed to generate AI response');
  }

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI service did not return any candidate content');
  }

  return text.trim();
}

/**
 * Basic text-only content generation.
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

  return callGeminiProxy(body);
}

/**
 * Chat-style conversation with system prompt.
 * Used by the Gaudai AI Assistant for contextual conversations.
 */
export async function chatWithGemini(systemPrompt, messages) {
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

  return callGeminiProxy(body);
}

/**
 * Multimodal image + text processing with browser-side compression.
 * Used for OCR of handwritten milk sheets, bills, and documents.
 */
export async function processImageWithGemini(prompt, imageBase64, mimeType = 'image/jpeg') {
  // 1. Shrink and compress image to fit within proxy payload
  const compressed = await shrinkAndCompressImage(imageBase64, mimeType);

  // 2. Validate payload size
  if (compressed.data.length > MAX_ALLOWED_BASE64_BYTES) {
    throw new Error(TOO_LARGE_ERROR_MSG);
  }

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: compressed.mimeType,
              data: compressed.data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 8192
    }
  };

  return callGeminiProxy(body);
}

/**
 * Categorize expense description using Gemini AI.
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
    return result.replace(/["'.\s]/g, '');
  } catch (error) {
    console.error('Failed to suggest expense category:', error);
    return lang === 'mr' ? 'इतर' : 'Other';
  }
}

/**
 * Generate 5 bullet point business insights using Gemini AI.
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
    return result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
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

/**
 * Process Excel spreadsheet JSON data with structured prompt.
 */
export async function processExcelWithGemini(prompt, excelJsonStr) {
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { text: excelJsonStr }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 8192
    }
  };

  return callGeminiProxy(body);
}

/**
 * Process a PDF file using Gemini multimodal via /api/gemini.
 */
export async function processPDFWithGemini(prompt, pdfBase64) {
  const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '');

  if (cleanBase64.length > MAX_ALLOWED_BASE64_BYTES) {
    throw new Error(TOO_LARGE_ERROR_MSG);
  }

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 8192
    }
  };

  return callGeminiProxy(body);
}

export default {
  generateContent,
  chatWithGemini,
  processImageWithGemini,
  suggestExpenseCategory,
  generateBusinessInsights,
  processExcelWithGemini,
  processPDFWithGemini,
  shrinkAndCompressImage
};
