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
export const imageToDescription = onCall(async (request: any) => {
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
export const parseMeal = onCall(async (request: any) => {
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

    // Check if this is a feedback/improvement request
    const hasFeedback = mealDescription.includes("Additional info:");

    let prompt = "";

    if (hasFeedback) {
      // Split original description and additional info
      const parts = mealDescription.split("\n\nAdditional info:");
      const originalMeal = parts[0];
      const additionalInfo = parts[1] || "";

      prompt = `Re-analyze this meal with additional information.

Original meal description: "${originalMeal}"

Additional info: "${additionalInfo}"

The user is providing additional information about their meal. Consider this new information:
- If they say "add X", include that item
- If they say "X was Yg", update that quantity
- If they say "remove X", exclude that item
- If they mention missing items, add them
- If they clarify cooking methods or specifics, use that information

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
    } else {
      // Original parsing prompt
      prompt = `Parse the following meal description and return a JSON
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
    }

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

interface Message {
  role: string;
  content: string;
  extractedData?: {
    name?: string;
    age?: number;
    weight?: number;
    weightUnit?: string;
    height?: number;
    heightUnit?: string;
    gender?: string;
    goal?: string;
    activityLevel?: string;
    workoutsPerWeek?: number;
  };
}

/**
 * AI-powered conversational onboarding
 * Chats with users to gather fitness info and calculate personalized plans
 */
export const chatOnboarding = onCall(async (request: any) => {
  console.log("💬 chatOnboarding called");

  const {conversationHistory, userMessage} = request.data;
  console.log("📝 User message:", userMessage);
  console.log("📜 Conversation length:", conversationHistory?.length || 0);

  if (!userMessage) {
    throw new HttpsError("invalid-argument", "User message is required");
  }

  try {
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});

    const prompt = `You are a friendly, supportive AI nutrition coach conducting an onboarding conversation.

Your goal is to naturally gather information about the user through conversation:
1. Their body (weight, height, age, gender)
2. Their fitness goals (lose weight, gain muscle, maintain, etc.)
3. Their current routine (activity level, workouts per week)
4. Optionally their name (but don't ask for it unless they offer)

CONVERSATION GUIDELINES:
- Be warm, encouraging, and conversational (not robotic)
- Ask follow-up questions naturally based on what they say
- Don't ask for everything at once - let the conversation flow
- React to what they say with empathy and understanding
- Use casual language like you're chatting with a friend
- When they mention a goal, show enthusiasm!

IMPORTANT: When you have enough information (age, weight, height, gender, goal, activity level), calculate their personalized plan using these formulas:

BMR (Mifflin-St Jeor):
- Male: (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
- Female: (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161

TDEE: BMR × activity multiplier
- Sedentary (0 workouts): 1.2
- Light (1-2/week): 1.375
- Moderate (3-4/week): 1.55
- Active (5-6/week): 1.725
- Very Active (7+/week): 1.9

Target Calories:
- Lose weight: TDEE × 0.85 (15% deficit)
- Gain muscle: TDEE × 1.10 (10% surplus)
- Maintain: TDEE

Macros (use target calories):
- Protein: 30% of calories ÷ 4 (grams)
- Carbs: 40% of calories ÷ 4 (grams)
- Fat: 30% of calories ÷ 9 (grams)

CONVERSATION HISTORY:
${conversationHistory.map((msg: Message) =>
    `${msg.role === "user" ? "User" : "Coach"}: ${msg.content}`
  ).join("\n")}

USER'S LATEST MESSAGE:
"${userMessage}"

Return ONLY valid JSON in this format (no markdown):
{
  "response": "your conversational response to the user",
  "extractedData": {
    "name": string or null,
    "age": number or null,
    "weight": number or null,
    "weightUnit": "kg" or "lbs" or null,
    "height": number or null,
    "heightUnit": "cm" or "ft" or null,
    "gender": "MALE" or "FEMALE" or "OTHER" or null,
    "goal": "LOSE_WEIGHT" or "BUILD_MUSCLE" or "MAINTAIN" or null,
    "activityLevel": "SEDENTARY" or "LIGHT" or "MODERATE" or "ACTIVE" or "VERY_ACTIVE" or null,
    "workoutsPerWeek": number or null
  },
  "isComplete": boolean (true if you have all needed data and calculated the plan),
  "calculatedPlan": {
    "dailyCalories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "reasoning": "brief 1-2 sentence explanation of the plan"
  } or null
}

EXAMPLES:

User: "Hey I'm John, 25 male, 180cm, 80kg, want to lose some weight"
Response:
{
  "response": "Nice to meet you, John! 💪 So you're looking to lose some weight - that's awesome that you're taking this step. How active would you say you are? Like, how many times a week do you typically work out or exercise?",
  "extractedData": {
    "name": "John",
    "age": 25,
    "weight": 80,
    "weightUnit": "kg",
    "height": 180,
    "heightUnit": "cm",
    "gender": "MALE",
    "goal": "LOSE_WEIGHT",
    "activityLevel": null,
    "workoutsPerWeek": null
  },
  "isComplete": false,
  "calculatedPlan": null
}

User: "I work out 3-4 times a week"
(Assuming previous data was collected)
Response:
{
  "response": "Perfect! That's a solid routine, John. Based on everything you've told me, I've calculated your personalized plan! 🎯\\n\\nYou'll be eating around 2000 calories per day to lose weight in a healthy, sustainable way. This gives you a moderate calorie deficit while keeping your energy up for those workouts. Ready to see the full breakdown?",
  "extractedData": {
    "name": "John",
    "age": 25,
    "weight": 80,
    "weightUnit": "kg",
    "height": 180,
    "heightUnit": "cm",
    "gender": "MALE",
    "goal": "LOSE_WEIGHT",
    "activityLevel": "MODERATE",
    "workoutsPerWeek": 4
  },
  "isComplete": true,
  "calculatedPlan": {
    "dailyCalories": 2000,
    "protein": 150,
    "carbs": 200,
    "fat": 67,
    "reasoning": "This plan creates a moderate 15% calorie deficit for healthy weight loss while supporting your workout routine."
  }
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log("🤖 AI Response:", text);

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }

    const chatResponse = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      ...chatResponse,
    };
  } catch (error) {
    console.error("Error in chat onboarding:", error);
    throw new HttpsError(
      "internal",
      "Failed to process chat",
      error
    );
  }
});
