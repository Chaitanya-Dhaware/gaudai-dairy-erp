const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash'; // Stable and highly responsive

export async function generateContent(prompt) {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not set.');
    throw new Error('API key missing');
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  return text.trim();
}

/**
 * Categorize expense description using Gemini AI.
 * @param {string} reason - Expense reason description
 * @param {string} lang - Language ('mr' or 'en')
 */
export async function suggestExpenseCategory(reason, lang = 'mr') {
  let prompt = '';
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
  let prompt = '';
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
