import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase.config';
import { userService } from '../services/firebase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔥 AuthContext: Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 AuthContext: Auth state changed', {
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid
      });

      if (firebaseUser) {
        setUser(firebaseUser);
        // Load user profile
        console.log('👤 AuthContext: Loading user profile...');
        let profile = await userService.getUserProfile(firebaseUser.uid);
        console.log('👤 AuthContext: Profile loaded:', {
          hasProfile: !!profile,
          hasDailyBudget: !!profile?.dailyBudget
        });

        // If profile doesn't exist yet, initialize it now so UI has personalCode/share code
        if (!profile) {
          console.log('🆕 AuthContext: No profile found. Creating default profile...');
          try {
            await userService.createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email || ''
            });
            // Re-fetch profile after creation
            profile = await userService.getUserProfile(firebaseUser.uid);
          } catch (e) {
            console.error('❌ AuthContext: Failed to create default profile', e);
          }
        }

        setUserProfile(profile);
      } else {
        console.log('🚪 AuthContext: User logged out');
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUserProfile = async () => {
    console.log('🔄 AuthContext: Manually refreshing user profile...');
    if (user) {
      const profile = await userService.getUserProfile(user.uid);
      console.log('🔄 AuthContext: Profile refreshed:', {
        hasProfile: !!profile,
        hasDailyBudget: !!profile?.dailyBudget
      });
      setUserProfile(profile);
    } else {
      console.log('⚠️ AuthContext: Cannot refresh - no user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        refreshUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
