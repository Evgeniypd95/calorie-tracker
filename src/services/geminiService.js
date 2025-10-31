import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export const parseMealDescription = async (mealDescription) => {
  try {
    const parseMeal = httpsCallable(functions, 'parseMeal');
    const result = await parseMeal({ mealDescription });

    if (result.data.success) {
      return result.data.data;
    } else {
      throw new Error('Failed to parse meal');
    }
  } catch (error) {
    console.error('Error calling parseMeal function:', error);
    throw error;
  }
};
