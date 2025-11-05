const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);

exports.parseMeal = functions.https.onCall(async (data, context) => {
  const { mealDescription, existingData } = data;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    let prompt;

    if (existingData) {
      // Refinement mode: adjust existing data based on feedback
      prompt = `
You are a nutrition expert. The user previously had this meal parsed:

EXISTING MEAL DATA:
${JSON.stringify(existingData, null, 2)}

The user is now giving feedback to ADJUST/MODIFY this existing meal. They said:
"${mealDescription}"

IMPORTANT: Do NOT search for a new meal. Instead, MODIFY the existing meal data based on their feedback.
Examples:
- If they say "3 cakes" or "I had 3", multiply the existing item's nutrition by 3
- If they say "add X", add X to the items array
- If they say "remove X" or "without X", remove that item
- If they say "half" or "50%", multiply quantities by 0.5
- If they say "double", multiply quantities by 2

Return ONLY a valid JSON object with the ADJUSTED nutritional information in this exact structure:
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

Return ONLY the JSON, no other text.`;
    } else {
      // Initial parse mode
      prompt = `
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
    }

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
