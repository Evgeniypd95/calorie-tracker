/**
 * Check-In Service
 *
 * Manages user feedback check-ins at 1 day, 7 days, and 1 month intervals
 * Adjusts calorie targets based on user feedback
 */

/**
 * Check if user should see a check-in prompt
 * @param {Object} userProfile - User's profile from Firestore
 * @returns {Object|null} - Check-in info if needed, null otherwise
 */
export function shouldShowCheckIn(userProfile) {
  if (!userProfile || !userProfile.onboardingCompletedAt) {
    return null;
  }

  const now = new Date();
  const nextCheckIn = userProfile.nextCheckInDate?.toDate
    ? userProfile.nextCheckInDate.toDate()
    : new Date(userProfile.nextCheckInDate);

  // If next check-in date has passed
  if (now >= nextCheckIn) {
    const onboardingDate = userProfile.onboardingCompletedAt.toDate
      ? userProfile.onboardingCompletedAt.toDate()
      : new Date(userProfile.onboardingCompletedAt);

    const daysSinceOnboarding = Math.floor((now - onboardingDate) / (1000 * 60 * 60 * 24));

    let checkInType;
    let nextCheckInDays;

    if (daysSinceOnboarding < 2) {
      checkInType = 'day1';
      nextCheckInDays = 7 - daysSinceOnboarding; // Next check-in in 7 days total
    } else if (daysSinceOnboarding < 8) {
      checkInType = 'week1';
      nextCheckInDays = 30 - daysSinceOnboarding; // Next check-in in 30 days total
    } else if (daysSinceOnboarding < 31) {
      checkInType = 'month1';
      nextCheckInDays = null; // No more automatic check-ins
    } else {
      return null; // Past all check-ins
    }

    return {
      type: checkInType,
      daysSinceOnboarding,
      nextCheckInDays
    };
  }

  return null;
}

/**
 * Get check-in questions based on type
 */
export function getCheckInQuestions(checkInType) {
  const questions = {
    day1: {
      title: "How's it going? 👋",
      subtitle: "You've been using the app for a day!",
      question: "How do you feel with your current calorie target?",
      options: [
        {
          value: 'TOO_HUNGRY',
          emoji: '😢',
          label: 'Too hungry',
          description: "I'm struggling to stay within my target"
        },
        {
          value: 'JUST_RIGHT',
          emoji: '😊',
          label: 'Just right',
          description: "Feeling good and sustainable"
        },
        {
          value: 'TOO_FULL',
          emoji: '😰',
          label: 'Too full',
          description: "Hard to eat this much food"
        }
      ]
    },
    week1: {
      title: "One week check-in 🎉",
      subtitle: "You've completed your first week!",
      question: "How's your energy and progress?",
      options: [
        {
          value: 'STRUGGLING',
          emoji: '😓',
          label: 'Struggling',
          description: "Low energy, hard to stick to plan"
        },
        {
          value: 'GOOD',
          emoji: '👍',
          label: 'Feeling good',
          description: "On track, sustainable pace"
        },
        {
          value: 'TOO_SLOW',
          emoji: '😐',
          label: 'Too slow',
          description: "Not seeing results I expected"
        },
        {
          value: 'TOO_FAST',
          emoji: '😰',
          label: 'Too aggressive',
          description: "Losing/gaining weight too quickly"
        }
      ]
    },
    month1: {
      title: "One month milestone! 🚀",
      subtitle: "Amazing - you've stuck with it for a month!",
      question: "How are your results compared to your goal?",
      options: [
        {
          value: 'BEHIND',
          emoji: '🐌',
          label: 'Behind target',
          description: "Not progressing as fast as I'd like"
        },
        {
          value: 'ON_TRACK',
          emoji: '🎯',
          label: 'Right on track',
          description: "Meeting my expectations perfectly"
        },
        {
          value: 'AHEAD',
          emoji: '🚀',
          label: 'Ahead of schedule',
          description: "Progressing faster than expected"
        }
      ]
    }
  };

  return questions[checkInType];
}

/**
 * Calculate target adjustment based on feedback
 * @param {number} currentTarget - Current daily calorie target
 * @param {string} feedback - User's feedback value
 * @param {string} checkInType - Type of check-in
 * @param {string} goal - User's goal (LOSE_WEIGHT, BUILD_MUSCLE, etc.)
 * @returns {Object} - { newTarget, adjustment, reason }
 */
export function calculateTargetAdjustment(currentTarget, feedback, checkInType, goal) {
  let adjustment = 0;
  let reason = '';

  // Day 1 adjustments
  if (checkInType === 'day1') {
    if (feedback === 'TOO_HUNGRY') {
      adjustment = 200;
      reason = "Added 200 calories to help with hunger and sustainability";
    } else if (feedback === 'TOO_FULL') {
      adjustment = -150;
      reason = "Reduced 150 calories since you're struggling to eat this much";
    } else {
      reason = "Great! Keeping your current target since it's working well";
    }
  }

  // Week 1 adjustments
  if (checkInType === 'week1') {
    if (feedback === 'STRUGGLING') {
      adjustment = 250;
      reason = "Added 250 calories to boost energy and make this more sustainable";
    } else if (feedback === 'TOO_SLOW') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = -200;
        reason = "Reduced 200 calories to speed up weight loss";
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = 200;
        reason = "Added 200 calories to accelerate muscle gain";
      }
    } else if (feedback === 'TOO_FAST') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = 200;
        reason = "Added 200 calories to slow down weight loss to a healthier pace";
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = -150;
        reason = "Reduced 150 calories to minimize fat gain while building muscle";
      }
    } else {
      reason = "Perfect! Your target is working great, no changes needed";
    }
  }

  // Month 1 adjustments
  if (checkInType === 'month1') {
    if (feedback === 'BEHIND') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = -150;
        reason = "Reduced 150 calories to accelerate progress";
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = 150;
        reason = "Added 150 calories to boost muscle gains";
      }
    } else if (feedback === 'AHEAD') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = 150;
        reason = "Added 150 calories to maintain steady, healthy progress";
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = -100;
        reason = "Reduced 100 calories to keep gains lean";
      }
    } else {
      reason = "Excellent! You're right on track, maintaining your current plan";
    }
  }

  const newTarget = Math.round(currentTarget + adjustment);

  return {
    newTarget,
    adjustment,
    reason
  };
}

/**
 * Get next check-in date after completing current check-in
 */
export function getNextCheckInDate(currentType) {
  const now = new Date();

  if (currentType === 'day1') {
    // Next check-in in 6 days (7 days total from onboarding)
    now.setDate(now.getDate() + 6);
  } else if (currentType === 'week1') {
    // Next check-in in 23 days (30 days total from onboarding)
    now.setDate(now.getDate() + 23);
  } else {
    // No more automatic check-ins after month 1
    return null;
  }

  return now;
}
