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
  deleteDoc,
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
    console.log('💾 userService.createUserProfile called:', {
      userId,
      profileData
    });

    const personalCode = generatePersonalCode();

    const dataToSave = {
      ...profileData,
      personalCode,
      following: [],
      followers: [],
      streakCount: 0,
      lastLogDate: null,
      createdAt: serverTimestamp()
    };

    console.log('💾 Saving to Firestore:', dataToSave);

    await setDoc(doc(db, 'users', userId), dataToSave);

    console.log('✅ Profile saved successfully. Personal code:', personalCode);
    return personalCode;
  },

  getUserProfile: async (userId) => {
    console.log('📖 userService.getUserProfile called for:', userId);
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    const profile = docSnap.exists() ? docSnap.data() : null;
    console.log('📖 Profile retrieved:', {
      exists: docSnap.exists(),
      hasData: !!profile,
      hasDailyBudget: !!profile?.dailyBudget
    });
    return profile;
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
  },

  getMealsByDate: async (userId, date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      where('date', '>=', startOfDay),
      where('date', '<=', endOfDay)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getRecentMeals: async (userId, limit = 5) => {
    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by createdAt descending and limit
    return meals
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  },

  searchMealsByDescription: async (userId, searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return [];
    }

    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter meals by description containing search term (case insensitive)
    const searchLower = searchTerm.toLowerCase();
    return meals
      .filter(meal => meal.description?.toLowerCase().includes(searchLower))
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
  },

  deleteMeal: async (mealId) => {
    await deleteDoc(doc(db, 'meals', mealId));
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

    // Prevent following yourself
    if (targetUserId === currentUserId) {
      throw new Error('You cannot connect to yourself');
    }

    // Add to following/followers
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    const currentUserDoc = await getDoc(currentUserRef);
    const targetUserDoc = await getDoc(targetUserRef);

    // Get data safely with fallback to empty object
    const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};
    const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

    const currentFollowing = currentUserData.following || [];
    const targetFollowers = targetUserData.followers || [];

    // Check if already following
    if (currentFollowing.includes(targetUserId)) {
      throw new Error('You are already connected to this user');
    }

    // Use setDoc with merge to handle cases where profile might not exist yet
    await setDoc(currentUserRef, {
      following: [...currentFollowing, targetUserId]
    }, { merge: true });

    await setDoc(targetUserRef, {
      followers: [...targetFollowers, currentUserId]
    }, { merge: true });
  },

  getFollowingUsers: async (userId) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return [];
    }

    const userData = userDoc.data();
    const following = userData?.following || [];

    if (following.length === 0) {
      return [];
    }

    const followingData = await Promise.all(
      following.map(async (id) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          return { id, ...userDoc.data() };
        }
        return null;
      })
    );

    return followingData.filter(user => user !== null);
  },

  unfollowUser: async (currentUserId, targetUserId) => {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    const currentUserDoc = await getDoc(currentUserRef);
    const targetUserDoc = await getDoc(targetUserRef);

    // Get data safely with fallback to empty object
    const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};
    const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

    const currentFollowing = currentUserData.following || [];
    const targetFollowers = targetUserData.followers || [];

    // Use setDoc with merge to handle cases where profile might not exist yet
    await setDoc(currentUserRef, {
      following: currentFollowing.filter(id => id !== targetUserId)
    }, { merge: true });

    await setDoc(targetUserRef, {
      followers: targetFollowers.filter(id => id !== currentUserId)
    }, { merge: true });
  },

  getFollowingMeals: async (userId, date) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return [];
    }

    const userData = userDoc.data();
    const following = userData?.following || [];

    if (following.length === 0) return [];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get meals from all followed users
    const mealsPromises = following.map(async (followedUserId) => {
      const q = query(
        collection(db, 'meals'),
        where('userId', '==', followedUserId),
        where('date', '>=', startOfDay),
        where('date', '<=', endOfDay)
      );

      const querySnapshot = await getDocs(q);
      const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get user info for each meal
      const userDoc = await getDoc(doc(db, 'users', followedUserId));
      const userData = userDoc.data();

      return meals.map(meal => ({
        ...meal,
        userName: userData.email?.split('@')[0] || 'User',
        userEmail: userData.email
      }));
    });

    const allMeals = await Promise.all(mealsPromises);
    return allMeals.flat().sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
  },

  copyMealToUser: async (targetUserId, meal) => {
    // Create a new meal for the target user with the same data
    const mealData = {
      mealType: meal.mealType,
      description: meal.description,
      items: meal.items,
      totals: meal.totals,
      date: new Date() // Use current time for the copy
    };

    return await mealService.logMeal(targetUserId, mealData);
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

  // If profile doesn't exist, skip streak update (will be handled when profile is created)
  if (!userDoc.exists()) {
    console.log('Profile does not exist yet, skipping streak update');
    return;
  }

  const userData = userDoc.data();
  const today = new Date().setHours(0, 0, 0, 0);
  const lastLog = userData?.lastLogDate?.toDate()?.setHours(0, 0, 0, 0);

  let newStreak = userData?.streakCount || 0;

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
