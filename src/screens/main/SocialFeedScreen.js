import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity, TextInput as RNTextInput, Platform, Share, Alert } from 'react-native';
import { Text, IconButton, Icon, Button, Snackbar, Portal, Chip, Modal } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { socialService, mealService } from '../../services/firebase';
import { useLocalization, getDayNameShort, getMealTypeLabel, getMealTypeLabelLower } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { GradientAvatar } from '../../components/ui';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const getDateRange = () => {
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    days.push(date);
  }
  return days;
};

const formatDate = (date, t) => ({
  day: getDayNameShort(date.getDay(), t),
  date: date.getDate()
});

const isSameDay = (date1, date2) =>
  date1.getDate() === date2.getDate() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getFullYear() === date2.getFullYear();

const ITEM_WIDTH = 56;

export default function SocialFeedScreen({ navigation }) {
  const { user, refreshUserProfile } = useAuth();
  const { t, localeCode } = useLocalization();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [feedMeals, setFeedMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [showComments, setShowComments] = useState({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [mealTypeDialogVisible, setMealTypeDialogVisible] = useState(false);
  const [selectedMealForCopy, setSelectedMealForCopy] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null);
  const [hiddenMeals, setHiddenMeals] = useState([]);
  const calendarRef = useRef(null);

  const days = getDateRange();

  const loadFeed = async (date = selectedDate) => {
    try {
      const meals = await socialService.getSocialFeed(user.uid, 20);

      const filteredMeals = meals.filter(meal => {
        const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
        return isSameDay(mealDate, date);
      });

      setFeedMeals(filteredMeals);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [selectedDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    loadFeed(date);
  };

  useEffect(() => {
    const indexOfToday = days.findIndex((d) => isSameDay(d, new Date()));
    if (calendarRef.current && indexOfToday >= 0) {
      setTimeout(() => {
        calendarRef.current.scrollTo({ x: Math.max(0, (indexOfToday - 3) * ITEM_WIDTH), animated: true });
      }, 0);
    }
  }, []);

  const handleLike = async (mealId) => {
    try {
      const updatedLikes = await mealService.toggleLike(mealId, user.uid);
      setFeedMeals(prev =>
        prev.map(meal =>
          meal.id === mealId ? { ...meal, likes: updatedLikes } : meal
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAddComment = async (mealId) => {
    const commentText = commentInputs[mealId]?.trim();
    if (!commentText) return;

    try {
      const userName = user.email?.split('@')[0] || t('common.you');
      const updatedComments = await mealService.addComment(mealId, user.uid, userName, commentText);

      setFeedMeals(prev =>
        prev.map(meal =>
          meal.id === mealId ? { ...meal, comments: updatedComments } : meal
        )
      );

      setCommentInputs(prev => ({ ...prev, [mealId]: '' }));
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const toggleComments = (mealId) => {
    setShowComments(prev => ({ ...prev, [mealId]: !prev[mealId] }));
  };

  const handleCopyMeal = (meal) => {
    setSelectedMealForCopy(meal);
    setMealTypeDialogVisible(true);
  };

  const confirmCopyMeal = async (mealType) => {
    if (!selectedMealForCopy) return;

    try {
      const mealData = {
        mealType: mealType,
        description: selectedMealForCopy.description,
        items: selectedMealForCopy.items,
        totals: selectedMealForCopy.totals,
        date: new Date(),
        copiedFrom: selectedMealForCopy.id
      };

      await mealService.logMeal(user.uid, mealData);
      refreshUserProfile();
      await mealService.incrementMealCopyCount(selectedMealForCopy.id, user.uid);

      setFeedMeals(prev =>
        prev.map(meal => {
          if (meal.id === selectedMealForCopy.id) {
            const copiedBy = meal.copiedBy || [];
            const updates = {
              ...meal,
              copiedByCount: (meal.copiedByCount || 0) + 1
            };
            if (!copiedBy.includes(user.uid)) {
              updates.copiedBy = [...copiedBy, user.uid];
            }
            return updates;
          }
          return meal;
        })
      );

      setMealTypeDialogVisible(false);
      setSelectedMealForCopy(null);
      setSnackbarMessage(t('social.addedToMeal', { mealType: getMealTypeLabelLower(mealType, t) }));
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error copying meal:', error);
      setMealTypeDialogVisible(false);
      setSnackbarMessage(t('social.failedToAdd'));
      setSnackbarVisible(true);
    }
  };

  const handleShare = async (meal) => {
    try {
      await Share.share({
        message: t('social.shareMessage', {
          description: meal.description,
          calories: meal.totals.calories,
          protein: meal.totals.protein,
          carbs: meal.totals.carbs,
          fat: meal.totals.fat
        }),
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleMenu = (mealId) => {
    setMenuVisible(mealId === menuVisible ? null : mealId);
  };

  const handleMenuAction = async (action, meal) => {
    setMenuVisible(null);

    switch (action) {
      case 'hide':
        setHiddenMeals(prev => [...prev, meal.id]);
        setSnackbarMessage(t('social.postHidden'));
        setSnackbarVisible(true);
        break;
      case 'report':
        setSnackbarMessage(t('social.postReported'));
        setSnackbarVisible(true);
        break;
      case 'unfollow':
        try {
          await socialService.unfollowUser(user.uid, meal.userId);
          setFeedMeals(prev => prev.filter(m => m.userId !== meal.userId));
          setSnackbarMessage(t('social.unfollowedName', { name: meal.userName }));
        } catch (error) {
          console.error('Error unfollowing:', error);
          setSnackbarMessage(t('social.unfollowFailed'));
        }
        setSnackbarVisible(true);
        break;
      case 'breakdown':
        Alert.alert(
          t('social.nutritionBreakdown'),
          meal.items.map(item => `${item.quantity} ${item.food}: ${item.calories} ${t('dashboard.calShort')}`).join('\n')
        );
        break;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('social.justNow');
    if (diffMins < 60) return t('social.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('social.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('social.daysAgo', { count: diffDays });
    return date.toLocaleDateString(localeCode);
  };

  const renderMealCard = (meal) => {
    const isLiked = meal.likes?.includes(user.uid);
    const likesCount = meal.likes?.length || 0;
    const commentsCount = meal.comments?.length || 0;
    const commentsVisible = showComments[meal.id];

    return (
      <View key={meal.id} style={styles.mealCard}>
        {/* 3-Dot Menu Dropdown */}
        {menuVisible === meal.id && (
          <View style={styles.menuOverlay}>
            <View style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('breakdown', meal)}
              >
                <Icon source="chart-donut" size={18} color={colors.body} />
                <Text style={styles.menuText}>{t('social.seeFullNutrition')}</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('hide', meal)}
              >
                <Icon source="eye-off-outline" size={18} color={colors.body} />
                <Text style={styles.menuText}>{t('social.hidePost')}</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('report', meal)}
              >
                <Icon source="flag-outline" size={18} color={colors.body} />
                <Text style={styles.menuText}>{t('social.report')}</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('unfollow', meal)}
              >
                <Icon source="account-remove-outline" size={18} color={colors.danger} />
                <Text style={[styles.menuText, styles.menuTextDanger]}>
                  {t('social.unfollow', { name: meal.userName })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Header: User info */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <GradientAvatar name={meal.userName} size={40} />
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>{meal.userName}</Text>
              <Text style={styles.mealTime}>
                {getMealTypeLabel(meal.mealType, t)} · {formatTime(meal.createdAt)}
              </Text>
            </View>
          </View>
          <IconButton
            icon="dots-horizontal"
            size={20}
            iconColor={colors.faint}
            onPress={() => handleMenu(meal.id)}
          />
        </View>

        {/* Meal Photo (if exists) */}
        {meal.imageUrl && (
          <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
        )}

        {/* Meal description */}
        <View style={styles.cardContent}>
          <Text style={styles.description}>{meal.description}</Text>

          {/* Nutrition summary */}
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionBadge}>
              <Text style={[styles.nutritionValue, { color: colors.primary }]}>{meal.totals.calories}</Text>
              <Text style={styles.nutritionLabel}>{t('social.caloriesShort')}</Text>
            </View>
            <View style={styles.nutritionDivider} />
            <View style={styles.nutritionBadge}>
              <Text style={[styles.nutritionValue, { color: colors.protein }]}>{Math.round(meal.totals.protein)}g</Text>
              <Text style={styles.nutritionLabel}>{t('social.protein')}</Text>
            </View>
            <View style={styles.nutritionDivider} />
            <View style={styles.nutritionBadge}>
              <Text style={[styles.nutritionValue, { color: colors.carbs }]}>{Math.round(meal.totals.carbs)}g</Text>
              <Text style={styles.nutritionLabel}>{t('social.carbs')}</Text>
            </View>
            <View style={styles.nutritionDivider} />
            <View style={styles.nutritionBadge}>
              <Text style={[styles.nutritionValue, { color: colors.fat }]}>{Math.round(meal.totals.fat)}g</Text>
              <Text style={styles.nutritionLabel}>{t('social.fat')}</Text>
            </View>
          </View>
        </View>

        {/* Actions: Like, Comment, Share, Add */}
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(meal.id)}>
              <Icon
                source={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? colors.danger : colors.body}
              />
              {likesCount > 0 && (
                <Text style={[styles.actionCount, isLiked && { color: colors.danger }]}>{likesCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => toggleComments(meal.id)}>
              <Icon source="comment-outline" size={21} color={colors.body} />
              {commentsCount > 0 && <Text style={styles.actionCount}>{commentsCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(meal)}>
              <Icon source="share-outline" size={22} color={colors.body} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addToDayButton} onPress={() => handleCopyMeal(meal)}>
            <Icon source="plus" size={16} color={colors.primary} />
            <Text style={styles.addToDayText}>{t('social.addToMyDay')}</Text>
          </TouchableOpacity>
        </View>

        {/* Engagement Stats */}
        {(meal.copiedBy?.includes(user.uid) || meal.copiedByCount > 0) && (
          <View style={styles.engagementStats}>
            {meal.copiedBy?.includes(user.uid) && (
              <View style={styles.engagementBadge}>
                <Icon source="check-circle" size={14} color={colors.success} />
                <Text style={styles.engagementText}>{t('social.youAddedThis')}</Text>
              </View>
            )}
            {meal.copiedByCount > 0 && (
              <View style={styles.engagementBadge}>
                <Icon source="account-multiple" size={14} color={colors.primary} />
                <Text style={styles.engagementText}>
                  {t('social.addedTimes', {
                    count: meal.copiedByCount,
                    timeWord: meal.copiedByCount === 1 ? t('social.time') : t('social.times')
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.commentsBlock}>
          {/* View comments button */}
          {commentsCount > 0 && !commentsVisible && (
            <TouchableOpacity onPress={() => toggleComments(meal.id)}>
              <Text style={styles.viewCommentsText}>
                {commentsCount === 1
                  ? t('social.viewCommentsSingle')
                  : t('social.viewCommentsAll', { count: commentsCount })}
              </Text>
            </TouchableOpacity>
          )}

          {/* Comments section */}
          {commentsVisible && meal.comments && meal.comments.length > 0 && (
            <View style={styles.commentsSection}>
              {meal.comments.map((comment, index) => (
                <View key={index} style={styles.commentRow}>
                  <GradientAvatar name={comment.userName} size={26} />
                  <Text style={styles.commentText}>
                    <Text style={styles.commentUserName}>{comment.userName}  </Text>
                    {comment.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Add comment input */}
          <View style={styles.addCommentRow}>
            <RNTextInput
              placeholder={t('social.addComment')}
              placeholderTextColor={colors.faint}
              value={commentInputs[meal.id] || ''}
              onChangeText={(text) =>
                setCommentInputs(prev => ({ ...prev, [meal.id]: text }))
              }
              style={styles.commentInput}
              onSubmitEditing={() => handleAddComment(meal.id)}
              returnKeyType="send"
            />
            {commentInputs[meal.id]?.trim() && (
              <TouchableOpacity onPress={() => handleAddComment(meal.id)}>
                <Text style={styles.postButton}>{t('social.post')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const visibleMeals = feedMeals.filter(meal => !hiddenMeals.includes(meal.id));

  return (
    <View style={styles.container}>
      {/* Calendar Strip */}
      <View style={styles.calendarRibbon}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}
          ref={calendarRef}
        >
          {days.map((day, index) => {
            const { day: dayName, date } = formatDate(day, t);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                onPress={() => handleDateSelect(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                  {dayName}
                </Text>
                <Text style={[
                  styles.dateNumber,
                  isSelected && styles.dateNumberSelected,
                  isToday && !isSelected && styles.todayDate
                ]}>
                  {date}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleMeals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🥗</Text>
            <Text style={styles.emptyTitle}>{t('social.noMealsYet')}</Text>
            <Text style={styles.emptyText}>{t('social.noMealsBody')}</Text>
          </View>
        ) : (
          visibleMeals.map(renderMealCard)
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Meal Type Selection Dialog */}
      <Portal>
        <Modal
          visible={mealTypeDialogVisible}
          onDismiss={() => setMealTypeDialogVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('social.addToMyDayTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('social.whichMealType')}</Text>

            <View style={styles.mealTypeChips}>
              {MEAL_TYPES.map((mealType) => (
                <Chip
                  key={mealType}
                  mode="outlined"
                  onPress={() => confirmCopyMeal(mealType)}
                  style={styles.mealTypeChip}
                >
                  {getMealTypeLabel(mealType, t)}
                </Chip>
              ))}
            </View>

            <Button
              mode="text"
              textColor={colors.muted}
              onPress={() => setMealTypeDialogVisible(false)}
              style={styles.cancelButton}
            >
              {t('common.cancel')}
            </Button>
          </View>
        </Modal>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  mealCard: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    position: 'relative',
    overflow: 'visible',
    ...shadows.card
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userNameContainer: {
    marginLeft: 10
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.ink,
    letterSpacing: -0.2
  },
  mealTime: {
    fontSize: 12,
    color: colors.faint,
    marginTop: 1
  },
  mealImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.subtle
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingTop: 12
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.body,
    marginBottom: 12
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.subtle,
    borderRadius: radius.md
  },
  nutritionBadge: {
    alignItems: 'center',
    flex: 1
  },
  nutritionDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border
  },
  nutritionValue: {
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.3
  },
  nutritionLabel: {
    fontSize: 10,
    color: colors.faint,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.body
  },
  addToDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill
  },
  addToDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  commentsBlock: {
    paddingHorizontal: 14,
    paddingBottom: 12
  },
  viewCommentsText: {
    color: colors.faint,
    fontSize: 13,
    marginBottom: 8
  },
  commentsSection: {
    marginBottom: 8,
    gap: 8
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: colors.body
  },
  commentUserName: {
    fontWeight: '700',
    color: colors.ink
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.subtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  postButton: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 12
  },
  emptyCard: {
    marginTop: 48,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14
  },
  emptyTitle: {
    ...type.heading,
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 6
  },
  emptyText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center'
  },
  menuOverlay: {
    position: 'absolute',
    top: 46,
    right: 10,
    zIndex: 1000
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minWidth: 230,
    paddingVertical: 4,
    ...shadows.raised
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.subtle
  },
  menuText: {
    fontSize: 14,
    color: colors.ink,
    flex: 1
  },
  menuTextDanger: {
    color: colors.danger
  },
  modalContainer: {
    padding: 20
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24
  },
  modalTitle: {
    ...type.title,
    fontSize: 20,
    marginBottom: 6,
    textAlign: 'center'
  },
  modalSubtitle: {
    ...type.body,
    color: colors.muted,
    marginBottom: 20,
    textAlign: 'center'
  },
  mealTypeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12
  },
  mealTypeChip: {
    marginBottom: 4
  },
  cancelButton: {
    marginTop: 4
  },
  snackbar: {
    backgroundColor: colors.ink
  },
  // Calendar strip
  calendarRibbon: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  calendarContent: {
    paddingHorizontal: 12
  },
  dateItem: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: radius.md
  },
  dateItemSelected: {
    backgroundColor: colors.primary,
    ...shadows.glow
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  dayNameSelected: {
    color: 'rgba(255,255,255,0.85)'
  },
  dateNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink
  },
  dateNumberSelected: {
    color: '#FFFFFF'
  },
  todayDate: {
    color: colors.primary
  },
  // Engagement stats
  engagementStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 8
  },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.subtle,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted
  }
});
