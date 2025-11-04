import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Get the default Firebase app instance
const app = getApp();

// Initialize Functions with the us-central1 region
const functions = getFunctions(app, 'us-central1');

// Uncomment to use local emulator during development
// connectFunctionsEmulator(functions, 'localhost', 5001);

export const parseMealDescription = async (mealDescription) => {
  // Check auth status
  const auth = getAuth();
  const currentUser = auth.currentUser;

  console.log('🔐 Auth Status Check:');
  console.log('  - Is user logged in?', !!currentUser);
  console.log('  - User ID:', currentUser?.uid);
  console.log('  - User email:', currentUser?.email);

  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      console.log('  - Auth token exists:', !!token);
      console.log('  - Token length:', token?.length);
    } catch (error) {
      console.error('  - Error getting token:', error);
    }
  } else {
    console.error('❌ NO USER LOGGED IN!');
  }

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
    console.error('Error details:', error.details);
    throw error;
  }
};

export const convertImageToDescription = async (imageData) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  console.log('🔐 imageToDescription Auth Check:');
  console.log('  - Is user logged in?', !!currentUser);

  if (!currentUser) {
    throw new Error('User must be logged in');
  }

  console.log('📸 Calling imageToDescription function');

  try {
    const imageToDescription = httpsCallable(functions, 'imageToDescription');
    const result = await imageToDescription({ imageData });

    console.log('✅ imageToDescription response:', result.data);

    if (result.data.success) {
      return result.data.description;
    } else {
      throw new Error('Failed to analyze image');
    }
  } catch (error) {
    console.error('❌ Error calling imageToDescription function:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', error.details);
    throw error;
  }
};
