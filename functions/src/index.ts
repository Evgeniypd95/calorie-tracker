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
 * Convert meal image to text description using Gemini Vision
 * Requires authentication
 */
export const imageToDescription = onCall(async (request) => {
  console.log("🔐 imageToDescription called");
  console.log("Auth object:", JSON.stringify(request.auth, null, 2));
  console.log("Has auth?", !!request.auth);
  console.log("User ID:", request.auth?.uid);

  const {imageData} = request.data;
  console.log("📸 Image data received:", imageData ? "Yes" : "No");

  if (!imageData) {
    throw new HttpsError("invalid-argument", "Image data is required");
  }

  try {
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});

    const prompt = `Analyze this food image and list ONLY the food items with quantities in METRIC units.

Format as a simple list, like a person describing what they ate:
- Start directly with food items
- Use METRIC measurements ONLY: grams (g), milliliters (ml), pieces
- Include quantities (e.g., "2 poached eggs", "60ml hollandaise sauce", "170g chicken breast")
- Include cooking methods when visible (grilled, fried, poached, etc.)
- Be specific but concise

Example good output:
"2 poached eggs, 60ml hollandaise sauce, 2 hash browns, 1 large grilled portobello mushroom, 60g grilled halloumi cheese, 250ml baked beans, small watercress salad, 6 grilled cherry tomatoes, 4 slices brown bread, 10g butter"

IMPORTANT - Use metric units:
- NOT "1/4 cup" → USE "60ml"
- NOT "2 oz" → USE "60g"
- NOT "6 oz" → USE "170g"
- NOT "1 cup" → USE "250ml"

DO NOT include:
- Introductory phrases like "Okay, here's..." or "Looks like..."
- Meal names or descriptions
- Analysis or commentary`;

    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const description = response.text();

    console.log("✅ Generated description:", description);

    return {
      success: true,
      description: description.trim(),
    };
  } catch (error) {
    console.error("Error converting image to description:", error);
    throw new HttpsError(
      "internal",
      "Failed to analyze meal image",
      error
    );
  }
});

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
calorie and macro estimates. Use METRIC units in quantities.

Meal: "${mealDescription}"

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "items": [
    {
      "food": "food name",
      "quantity": "amount in metric (e.g., '170g', '250ml', '2 pieces')",
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

Use metric measurements:
- Weights in grams (g)
- Liquids in milliliters (ml)
- Counts as pieces/items`;

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
