import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase.config';

export const authService = {
  signup: async (email, password) => {
    return await createUserWithEmailAndPassword(auth, email, password);
  },

  login: async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  logout: async () => {
    return await signOut(auth);
  }
};

export const userService = {
  createUserProfile: async (userId, profileData) => {
    const personalCode = generatePersonalCode();

    await setDoc(doc(db, 'users', userId), {
      ...profileData,
      personalCode,
      following: [],
      followers: [],
      streakCount: 0,
      lastLogDate: null,
      createdAt: serverTimestamp()
    });

    return personalCode;
  },

  getUserProfile: async (userId) => {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  },

  updateUserProfile: async (userId, updates) => {
    await updateDoc(doc(db, 'users', userId), updates);
  }
};

export const mealService = {
  logMeal: async (userId, mealData) => {
    const mealRef = await addDoc(collection(db, 'meals'), {
      userId,
      ...mealData,
      createdAt: serverTimestamp()
    });

    // Update streak
    await updateStreak(userId);

    return mealRef.id;
  },

  getTodaysMeals: async (userId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      where('date', '>=', today)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

export const socialService = {
  followUser: async (currentUserId, personalCode) => {
    // Find user by personal code
    const q = query(
      collection(db, 'users'),
      where('personalCode', '==', personalCode)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) throw new Error('User not found');

    const targetUserId = querySnapshot.docs[0].id;

    // Add to following/followers
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    const currentUserDoc = await getDoc(currentUserRef);
    const targetUserDoc = await getDoc(targetUserRef);

    const currentFollowing = currentUserDoc.data().following || [];
    const targetFollowers = targetUserDoc.data().followers || [];

    await updateDoc(currentUserRef, {
      following: [...currentFollowing, targetUserId]
    });

    await updateDoc(targetUserRef, {
      followers: [...targetFollowers, currentUserId]
    });
  },

  getFollowingUsers: async (userId) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const following = userDoc.data().following || [];

    const followingData = await Promise.all(
      following.map(async (id) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        return { id, ...userDoc.data() };
      })
    );

    return followingData;
  }
};

// Helper functions
function generatePersonalCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FIT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function updateStreak(userId) {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const userData = userDoc.data();

  const today = new Date().setHours(0, 0, 0, 0);
  const lastLog = userData.lastLogDate?.toDate().setHours(0, 0, 0, 0);

  let newStreak = userData.streakCount || 0;

  if (!lastLog) {
    newStreak = 1;
  } else {
    const daysDiff = (today - lastLog) / (1000 * 60 * 60 * 24);

    if (daysDiff === 1) {
      newStreak += 1;
    } else if (daysDiff > 1) {
      newStreak = 1;
    }
  }

  await updateDoc(userRef, {
    streakCount: newStreak,
    lastLogDate: new Date()
  });
}
