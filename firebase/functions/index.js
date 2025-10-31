const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);

exports.parseMeal = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { mealDescription } = data;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are a nutrition expert. Parse the following meal description and return ONLY a valid JSON object with nutritional information. Do not include any markdown formatting or additional text.

Meal: "${mealDescription}"

Return the response in this exact JSON structure:
{
  "items": [
    {
      "food": "food name",
      "quantity": "amount",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  }
}

Be as accurate as possible with standard serving sizes. Return ONLY the JSON, no other text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const nutritionData = JSON.parse(text);

    return {
      success: true,
      data: nutritionData
    };
  } catch (error) {
    console.error('Error parsing meal:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to parse meal description',
      error.message
    );
  }
});
