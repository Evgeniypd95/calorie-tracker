import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getApp } from 'firebase/app';

// Get the default Firebase app instance
const app = getApp();

// Initialize Functions with the us-central1 region
const functions = getFunctions(app, 'us-central1');

// Uncomment to use local emulator during development
// connectFunctionsEmulator(functions, 'localhost', 5001);

export const parseMealDescription = async (mealDescription) => {
  console.log('🤖 Calling parseMeal function with:', mealDescription);

  try {
    const parseMeal = httpsCallable(functions, 'parseMeal');
    const result = await parseMeal({ mealDescription });

    console.log('✅ parseMeal response:', result.data);

    if (result.data.success) {
      return result.data.data;
    } else {
      throw new Error('Failed to parse meal');
    }
  } catch (error) {
    console.error('❌ Error calling parseMeal function:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
};
