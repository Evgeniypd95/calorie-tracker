import React, { createContext, useState, useContext } from 'react';
import { userService } from '../services/firebase';
import { useAuth } from './AuthContext';

const OnboardingContext = createContext({});

// Helper to calculate next check-in date
const getNextCheckInDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

export const OnboardingProvider = ({ children }) => {
  const { user, refreshUserProfile } = useAuth();
  const [onboardingData, setOnboardingData] = useState({
    goal: null, // 'LOSE_WEIGHT' | 'BUILD_MUSCLE' | 'MAINTAIN' | 'EXPLORING'
    age: 30,
    weight: 70, // kg
    height: 170, // cm
    desiredWeight: null, // kg
    activityLevel: 'MODERATE', // 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
    workoutsPerWeek: 3, // 0-7
    weightUnit: 'kg', // 'kg' | 'lbs'
    heightUnit: 'cm', // 'cm' | 'ft'
    gender: 'MALE', // 'MALE' | 'FEMALE' | 'OTHER'
    bodyType: 'MESOMORPH', // 'ECTOMORPH' | 'MESOMORPH' | 'ENDOMORPH'
    strategy: 'CHALLENGING', // 'COMFORTABLE' | 'CHALLENGING' | 'AGGRESSIVE'
    strategyMultiplier: 0.85, // Deficit/surplus multiplier
    enableWeekendFlexibility: false,
    weekendOption: 'SAT_SUN', // 'FRI_SAT_SUN' | 'SAT_SUN' | 'FRI_SAT'
    weekendBonusCalories: 300,
    weekdayCalories: null,
    weekendCalories: null,
    dailyCalorieTarget: null,
    proteinTarget: null,
    carbsTarget: null,
    fatTarget: null,
    preferredInputMethod: null, // 'voice' | 'photo' | 'barcode'
    isPublic: false,
    notificationsEnabled: false,
    notificationTimes: {
      breakfast: '08:00',
      lunch: '12:00',
      dinner: '18:00',
      dailySummary: '20:00'
    }
  });

  const updateOnboardingData = (updates) => {
    setOnboardingData(prev => ({ ...prev, ...updates }));
  };

  // Calculate TDEE (Total Daily Energy Expenditure)
  const calculateTDEE = () => {
    const { age, weight, height, gender, activityLevel, bodyType } = onboardingData;

    // Convert to metric if needed
    let weightKg = weight;
    let heightCm = height;

    if (onboardingData.weightUnit === 'lbs') {
      weightKg = weight * 0.453592;
    }

    if (onboardingData.heightUnit === 'ft') {
      // Height stored as total inches
      heightCm = height * 2.54;
    }

    // Mifflin-St Jeor Equation
    let bmr;
    if (gender === 'MALE') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
      SEDENTARY: 1.2,
      LIGHT: 1.375,
      MODERATE: 1.55,
      ACTIVE: 1.725,
      VERY_ACTIVE: 1.9
    };

    let tdee = bmr * activityMultipliers[activityLevel];

    // Body type adjustment (affects metabolism)
    const bodyTypeMultipliers = {
      ECTOMORPH: 1.05,   // Fast metabolism: +5%
      MESOMORPH: 1.0,    // Average metabolism: no change
      ENDOMORPH: 0.95    // Slower metabolism: -5%
    };

    tdee = Math.round(tdee * bodyTypeMultipliers[bodyType || 'MESOMORPH']);

    return tdee;
  };

  // Calculate target based on goal
  const calculateTargetCalories = () => {
    const tdee = calculateTDEE();
    const { goal } = onboardingData;

    switch (goal) {
      case 'LOSE_WEIGHT':
        return Math.round(tdee * 0.85); // 15% deficit
      case 'BUILD_MUSCLE':
        return Math.round(tdee * 1.1); // 10% surplus
      case 'MAINTAIN':
      case 'EXPLORING':
      default:
        return tdee;
    }
  };

  // Complete onboarding and save to Firestore
  const completeOnboarding = async () => {
    if (!user) return;

    const dailyCalorieTarget = onboardingData.dailyCalorieTarget || calculateTargetCalories();

    const profileUpdates = {
      onboardingCompleted: true,
      goal: onboardingData.goal,
      age: onboardingData.age,
      weight: onboardingData.weight,
      height: onboardingData.height,
      desiredWeight: onboardingData.desiredWeight,
      weightUnit: onboardingData.weightUnit,
      heightUnit: onboardingData.heightUnit,
      gender: onboardingData.gender,
      bodyType: onboardingData.bodyType,
      activityLevel: onboardingData.activityLevel,
      workoutsPerWeek: onboardingData.workoutsPerWeek,
      strategy: onboardingData.strategy,
      strategyMultiplier: onboardingData.strategyMultiplier,
      enableWeekendFlexibility: onboardingData.enableWeekendFlexibility,
      weekendOption: onboardingData.weekendOption,
      weekendBonusCalories: onboardingData.weekendBonusCalories,
      weekdayCalories: onboardingData.weekdayCalories,
      weekendCalories: onboardingData.weekendCalories,
      dailyCalorieTarget,
      proteinTarget: onboardingData.proteinTarget,
      carbsTarget: onboardingData.carbsTarget,
      fatTarget: onboardingData.fatTarget,
      preferredInputMethod: onboardingData.preferredInputMethod,
      isPublic: onboardingData.isPublic,
      notificationsEnabled: onboardingData.notificationsEnabled,
      notificationTimes: onboardingData.notificationTimes,
      onboardingCompletedAt: new Date(),
      // Initialize check-in tracking
      nextCheckInDate: getNextCheckInDate(1), // First check-in after 1 day
      checkInHistory: []
    };

    await userService.updateUserProfile(user.uid, profileUpdates);
    await refreshUserProfile();
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingData,
        updateOnboardingData,
        calculateTDEE,
        calculateTargetCalories,
        completeOnboarding
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
