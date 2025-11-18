import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  getAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration using environment variables
// Make sure to set these in your .env file with EXPO_PUBLIC_ prefix
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key] || firebaseConfig[key] === 'your_api_key_here');

if (missingKeys.length > 0) {
  console.error('Missing or invalid Firebase configuration values:', missingKeys);
  console.error('Please update your .env file with proper Firebase credentials');
}

const app = initializeApp(firebaseConfig);

// Initialize Auth with platform-specific persistence
// Web: use browserLocalPersistence (default, stores in localStorage)
// Native (iOS/Android): use AsyncStorage persistence
let auth;
if (Platform.OS === 'web') {
  // For web, use getAuth which defaults to browserLocalPersistence
  auth = getAuth(app);
  // Explicitly set to local persistence to ensure session persists across browser sessions
  auth.setPersistence(browserLocalPersistence);
} else {
  // For native platforms (iOS/Android), use AsyncStorage
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { auth };
export const db = getFirestore(app);
