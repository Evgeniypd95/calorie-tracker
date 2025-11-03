/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {GoogleGenerativeAI} from "@google/generative-ai";

setGlobalOptions({maxInstances: 10});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);

/**
 * Parse meal description using Gemini AI
 * Requires authentication
 */
export const parseMeal = onCall(async (request) => {
  console.log("🔐 parseMeal called");
  console.log("Auth object:", JSON.stringify(request.auth, null, 2));
  console.log("Has auth?", !!request.auth);
  console.log("User ID:", request.auth?.uid);

  const {mealDescription} = request.data;
  console.log("📝 Meal description:", mealDescription);

  if (!mealDescription) {
    throw new HttpsError("invalid-argument", "Meal description is required");
  }

  try {
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});

    const prompt = `Parse the following meal description and return a JSON
object with nutritional information. Be as accurate as possible with
calorie and macro estimates.

Meal: "${mealDescription}"

Return ONLY valid JSON in this exact format (no markdown, no explanations):
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
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }

    const nutritionData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: nutritionData,
    };
  } catch (error) {
    console.error("Error parsing meal:", error);
    throw new HttpsError(
      "internal",
      "Failed to parse meal description",
      error
    );
  }
}
);
