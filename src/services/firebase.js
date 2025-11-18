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
  deleteDoc
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
      createdAt: new Date()
    };

    console.log('💾 Saving to Firestore:', dataToSave);

    try {
      await setDoc(doc(db, 'users', userId), dataToSave);
      console.log('✅ Profile saved successfully. Personal code:', personalCode);
      return personalCode;
    } catch (error) {
      console.error('❌ Error saving profile to Firestore:', error);
      throw error;
    }
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
    console.log('🔥 [Firebase] logMeal called');
    console.log('👤 [Firebase] User ID:', userId);
    console.log('📦 [Firebase] Meal data:', JSON.stringify(mealData, null, 2));

    try {
      const dataToSave = {
        userId,
        ...mealData,
        createdAt: new Date()
      };
      console.log('💾 [Firebase] Data to save:', JSON.stringify(dataToSave, null, 2));

      console.log('🔥 [Firebase] Adding document to meals collection');
      const mealRef = await addDoc(collection(db, 'meals'), dataToSave);
      console.log('✅ [Firebase] Meal document created with ID:', mealRef.id);

      // Update streak
      console.log('🔥 [Firebase] Updating user streak');
      await updateStreak(userId);
      console.log('✅ [Firebase] Streak updated successfully');

      console.log('✅ [Firebase] logMeal complete, returning ID:', mealRef.id);
      return mealRef.id;
    } catch (error) {
      console.error('❌ [Firebase] Error logging meal:', error);
      console.error('❌ [Firebase] Error code:', error.code);
      console.error('❌ [Firebase] Error message:', error.message);
      console.error('❌ [Firebase] Error stack:', error.stack);
      throw error;
    }
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
    const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by date descending (latest first)
    return meals.sort((a, b) => {
      const timeA = a.date?.toMillis?.() || a.date?.getTime?.() || 0;
      const timeB = b.date?.toMillis?.() || b.date?.getTime?.() || 0;
      return timeB - timeA;
    });
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
  },

  toggleLike: async (mealId, userId) => {
    const mealRef = doc(db, 'meals', mealId);
    const mealDoc = await getDoc(mealRef);

    if (!mealDoc.exists()) {
      throw new Error('Meal not found');
    }

    const mealData = mealDoc.data();
    const likes = mealData.likes || [];

    // Toggle like
    const updatedLikes = likes.includes(userId)
      ? likes.filter(id => id !== userId)
      : [...likes, userId];

    await updateDoc(mealRef, { likes: updatedLikes });
    return updatedLikes;
  },

  addComment: async (mealId, userId, userName, commentText) => {
    const mealRef = doc(db, 'meals', mealId);
    const mealDoc = await getDoc(mealRef);

    if (!mealDoc.exists()) {
      throw new Error('Meal not found');
    }

    const mealData = mealDoc.data();
    const comments = mealData.comments || [];

    const newComment = {
      userId,
      userName,
      text: commentText,
      timestamp: new Date()
    };

    const updatedComments = [...comments, newComment];
    await updateDoc(mealRef, { comments: updatedComments });
    return updatedComments;
  },

  deleteComment: async (mealId, commentIndex) => {
    const mealRef = doc(db, 'meals', mealId);
    const mealDoc = await getDoc(mealRef);

    if (!mealDoc.exists()) {
      throw new Error('Meal not found');
    }

    const mealData = mealDoc.data();
    const comments = mealData.comments || [];
    const updatedComments = comments.filter((_, index) => index !== commentIndex);

    await updateDoc(mealRef, { comments: updatedComments });
    return updatedComments;
  },

  duplicateMeal: async (userId, meal, targetDate) => {
    // Create a copy of the meal for the target date
    const duplicatedMeal = {
      userId,
      description: meal.description,
      mealType: meal.mealType,
      items: meal.items,
      totals: meal.totals,
      date: targetDate,
      createdAt: new Date()
    };

    const mealRef = await addDoc(collection(db, 'meals'), duplicatedMeal);
    return mealRef.id;
  },

  getUserMeals: async (userId, daysBack = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      where('date', '>=', startDate)
    );

    const querySnapshot = await getDocs(q);
    const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by date descending
    return meals.sort((a, b) => {
      const timeA = a.date?.toMillis?.() || 0;
      const timeB = b.date?.toMillis?.() || 0;
      return timeB - timeA;
    });
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

    // Add to following/followers on BOTH users (mutual connection)
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    const currentUserDoc = await getDoc(currentUserRef);
    const targetUserDoc = await getDoc(targetUserRef);

    // Get data safely with fallback to empty object
    const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};
    const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};

    const currentFollowing = currentUserData.following || [];
    const currentFollowers = currentUserData.followers || [];
    const targetFollowing = targetUserData.following || [];
    const targetFollowers = targetUserData.followers || [];

    // Check if already connected
    const alreadyConnected = currentFollowing.includes(targetUserId) && targetFollowing.includes(currentUserId);
    if (alreadyConnected) {
      throw new Error('You are already connected to this user');
    }

    // Use setDoc with merge to handle cases where profile might not exist yet
    await setDoc(currentUserRef, {
      following: currentFollowing.includes(targetUserId) ? currentFollowing : [...currentFollowing, targetUserId],
      followers: currentFollowers.includes(targetUserId) ? currentFollowers : [...currentFollowers, targetUserId]
    }, { merge: true });

    await setDoc(targetUserRef, {
      following: targetFollowing.includes(currentUserId) ? targetFollowing : [...targetFollowing, currentUserId],
      followers: targetFollowers.includes(currentUserId) ? targetFollowers : [...targetFollowers, currentUserId]
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

    // Remove connection in BOTH directions
    await setDoc(currentUserRef, {
      following: currentFollowing.filter(id => id !== targetUserId),
      followers: currentFollowers.filter(id => id !== targetUserId)
    }, { merge: true });

    await setDoc(targetUserRef, {
      following: targetFollowing.filter(id => id !== currentUserId),
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
  },

  // Get social feed (recent meals from connections, Instagram-style)
  getSocialFeed: async (userId, limit = 20) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return [];
    }

    const userData = userDoc.data();
    const following = userData?.following || [];

    if (following.length === 0) return [];

    // Get recent meals from all followed users
    const mealsPromises = following.map(async (followedUserId) => {
      const q = query(
        collection(db, 'meals'),
        where('userId', '==', followedUserId)
      );

      const querySnapshot = await getDocs(q);
      const meals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get user info
      const userDoc = await getDoc(doc(db, 'users', followedUserId));
      const userData = userDoc.data();

      return meals.map(meal => ({
        ...meal,
        userId: followedUserId,
        userName: userData.email?.split('@')[0] || 'User',
        userEmail: userData.email,
        likes: meal.likes || [],
        comments: meal.comments || []
      }));
    });

    const allMeals = await Promise.all(mealsPromises);

    // Sort by creation time, most recent first, and limit
    return allMeals.flat()
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      })
      .slice(0, limit);
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
