// streakCount in Firestore is only updated when a meal is logged, so it goes
// stale (a user who stopped logging keeps their old count). Compute the streak
// to DISPLAY from lastLogDate: anything older than yesterday means the streak
// is broken and shows as 0.
export function getEffectiveStreak(userProfile) {
  if (!userProfile?.streakCount || !userProfile?.lastLogDate) return 0;

  const last = userProfile.lastLogDate?.toDate?.() || new Date(userProfile.lastLogDate);
  if (isNaN(last.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(last);
  lastDay.setHours(0, 0, 0, 0);

  const daysDiff = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));
  return daysDiff <= 1 ? userProfile.streakCount : 0;
}
