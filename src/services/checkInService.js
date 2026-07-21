/**
 * Check-In Service
 *
 * Manages user feedback check-ins at 1 day, 7 days, and 1 month intervals
 * Adjusts calorie targets based on user feedback
 */
import { t } from '../localization/i18n';

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
      title: t('checkIn.day1Title'),
      subtitle: t('checkIn.day1Subtitle'),
      question: t('checkIn.day1Question'),
      options: [
        {
          value: 'TOO_HUNGRY',
          emoji: '😢',
          label: t('checkIn.tooHungry'),
          description: t('checkIn.tooHungryDesc')
        },
        {
          value: 'JUST_RIGHT',
          emoji: '😊',
          label: t('checkIn.justRight'),
          description: t('checkIn.justRightDesc')
        },
        {
          value: 'TOO_FULL',
          emoji: '😰',
          label: t('checkIn.tooFull'),
          description: t('checkIn.tooFullDesc')
        }
      ]
    },
    week1: {
      title: t('checkIn.week1Title'),
      subtitle: t('checkIn.week1Subtitle'),
      question: t('checkIn.week1Question'),
      options: [
        {
          value: 'STRUGGLING',
          emoji: '😓',
          label: t('checkIn.struggling'),
          description: t('checkIn.strugglingDesc')
        },
        {
          value: 'GOOD',
          emoji: '👍',
          label: t('checkIn.good'),
          description: t('checkIn.goodDesc')
        },
        {
          value: 'TOO_SLOW',
          emoji: '😐',
          label: t('checkIn.tooSlow'),
          description: t('checkIn.tooSlowDesc')
        },
        {
          value: 'TOO_FAST',
          emoji: '😰',
          label: t('checkIn.tooFast'),
          description: t('checkIn.tooFastDesc')
        }
      ]
    },
    month1: {
      title: t('checkIn.month1Title'),
      subtitle: t('checkIn.month1Subtitle'),
      question: t('checkIn.month1Question'),
      options: [
        {
          value: 'BEHIND',
          emoji: '🐌',
          label: t('checkIn.behind'),
          description: t('checkIn.behindDesc')
        },
        {
          value: 'ON_TRACK',
          emoji: '🎯',
          label: t('checkIn.onTrack'),
          description: t('checkIn.onTrackDesc')
        },
        {
          value: 'AHEAD',
          emoji: '🚀',
          label: t('checkIn.ahead'),
          description: t('checkIn.aheadDesc')
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
      reason = t('checkIn.adjustHungry');
    } else if (feedback === 'TOO_FULL') {
      adjustment = -150;
      reason = t('checkIn.adjustFull');
    } else {
      reason = t('checkIn.adjustKeep');
    }
  }

  // Week 1 adjustments
  if (checkInType === 'week1') {
    if (feedback === 'STRUGGLING') {
      adjustment = 250;
      reason = t('checkIn.adjustStruggling');
    } else if (feedback === 'TOO_SLOW') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = -200;
        reason = t('checkIn.adjustSlowLose');
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = 200;
        reason = t('checkIn.adjustSlowGain');
      }
    } else if (feedback === 'TOO_FAST') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = 200;
        reason = t('checkIn.adjustFastLose');
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = -150;
        reason = t('checkIn.adjustFastGain');
      }
    } else {
      reason = t('checkIn.adjustPerfect');
    }
  }

  // Month 1 adjustments
  if (checkInType === 'month1') {
    if (feedback === 'BEHIND') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = -150;
        reason = t('checkIn.adjustBehindLose');
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = 150;
        reason = t('checkIn.adjustBehindGain');
      }
    } else if (feedback === 'AHEAD') {
      if (goal === 'LOSE_WEIGHT') {
        adjustment = 150;
        reason = t('checkIn.adjustAheadLose');
      } else if (goal === 'BUILD_MUSCLE') {
        adjustment = -100;
        reason = t('checkIn.adjustAheadGain');
      }
    } else {
      reason = t('checkIn.adjustExcellent');
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
