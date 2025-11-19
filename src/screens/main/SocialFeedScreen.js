import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity, TextInput as RNTextInput, Platform, Share, Alert, Modal } from 'react-native';
import { Text, Card, IconButton, Surface, Divider, Avatar, Button, TextInput, Snackbar, Portal, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { socialService, mealService } from '../../services/firebase';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// Helper function to get a date range (7 days past, today, 7 days future)
const getDateRange = () => {
  const days = [];
  for (let i = -7; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    days.push(date);
  }
  return days;
};

// Helper function to format date
const formatDate = (date) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    day: days[date.getDay()],
    date: date.getDate()
  };
};

// Helper function to check if two dates are the same day
const isSameDay = (date1, date2) => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

const ITEM_WIDTH = 60;

export default function SocialFeedScreen({ navigation }) {
  const { user } = useAuth();
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
  const calendarRef = useRef(null);

  const days = getDateRange();

  const loadFeed = async (date = selectedDate) => {
    try {
      const meals = await socialService.getSocialFeed(user.uid, 20);

      // Filter meals by selected date
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

  // Auto-scroll calendar ribbon to today on first render
  useEffect(() => {
    const indexOfToday = days.findIndex((d) => isSameDay(d, new Date()));

    if (calendarRef.current && indexOfToday >= 0) {
      setTimeout(() => {
        calendarRef.current.scrollTo({ x: Math.max(0, (indexOfToday - 2) * ITEM_WIDTH), animated: true });
      }, 0);
    }
  }, []);

  const handleLike = async (mealId) => {
    try {
      const updatedLikes = await mealService.toggleLike(mealId, user.uid);

      // Update local state
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
      const userName = user.email?.split('@')[0] || 'You';
      const updatedComments = await mealService.addComment(mealId, user.uid, userName, commentText);

      // Update local state
      setFeedMeals(prev =>
        prev.map(meal =>
          meal.id === mealId ? { ...meal, comments: updatedComments } : meal
        )
      );

      // Clear input
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
      // Copy meal with selected type
      const mealData = {
        mealType: mealType,
        description: selectedMealForCopy.description,
        items: selectedMealForCopy.items,
        totals: selectedMealForCopy.totals,
        date: new Date(),
        copiedFrom: selectedMealForCopy.id // Track that this was copied from feed
      };

      await mealService.logMeal(user.uid, mealData);

      // Increment the "added by" count on the original meal
      await mealService.incrementMealCopyCount(selectedMealForCopy.id, user.uid);

      // Update local state to reflect the change
      setFeedMeals(prev =>
        prev.map(meal => {
          if (meal.id === selectedMealForCopy.id) {
            const copiedBy = meal.copiedBy || [];
            const updates = {
              ...meal,
              copiedByCount: (meal.copiedByCount || 0) + 1
            };

            // Add user to copiedBy if not already there (for green badge)
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
      setSnackbarMessage(`Added to your ${mealType}! 🎉`);
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error copying meal:', error);
      setMealTypeDialogVisible(false);
      setSnackbarMessage('Failed to add meal');
      setSnackbarVisible(true);
    }
  };

  const handleShare = async (meal) => {
    try {
      await Share.share({
        message: `Check out this meal: ${meal.description}\n\n🔥 ${meal.totals.calories} cal | 💪 ${meal.totals.protein}g protein | 🍞 ${meal.totals.carbs}g carbs | 🥑 ${meal.totals.fat}g fat`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleMenu = (mealId) => {
    setMenuVisible(mealId === menuVisible ? null : mealId);
  };

  const handleMenuAction = (action, meal) => {
    setMenuVisible(null);

    switch (action) {
      case 'hide':
        setSnackbarMessage('Post hidden (placeholder)');
        setSnackbarVisible(true);
        break;
      case 'report':
        setSnackbarMessage('Post reported (placeholder)');
        setSnackbarVisible(true);
        break;
      case 'unfollow':
        setSnackbarMessage(`Unfollowed ${meal.userName} (placeholder)`);
        setSnackbarVisible(true);
        break;
      case 'breakdown':
        // Show full nutrition breakdown
        Alert.alert(
          'Nutrition Breakdown',
          meal.items.map(item => `${item.quantity} ${item.food}: ${item.calories} cal`).join('\n')
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

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderMealCard = (meal) => {
    const isLiked = meal.likes?.includes(user.uid);
    const likesCount = meal.likes?.length || 0;
    const commentsCount = meal.comments?.length || 0;
    const commentsVisible = showComments[meal.id];

    return (
      <Card key={meal.id} style={styles.mealCard}>
        {/* 3-Dot Menu Dropdown */}
        {menuVisible === meal.id && (
          <View style={styles.menuOverlay}>
            <Card style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('breakdown', meal)}
              >
                <Text style={styles.menuText}>See full nutrition</Text>
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('hide', meal)}
              >
                <Text style={styles.menuText}>Hide this post</Text>
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('report', meal)}
              >
                <Text style={styles.menuText}>Report</Text>
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleMenuAction('unfollow', meal)}
              >
                <Text style={[styles.menuText, styles.menuTextDanger]}>Unfollow {meal.userName}</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Header: User info */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Avatar.Text
              size={40}
              label={meal.userName?.charAt(0).toUpperCase() || 'U'}
              style={styles.avatar}
            />
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>{meal.userName}</Text>
              <Text style={styles.mealTime}>
                {meal.mealType} • {formatTime(meal.createdAt)}
              </Text>
            </View>
          </View>
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={() => handleMenu(meal.id)}
          />
        </View>

        {/* Meal Photo (if exists) */}
        {meal.imageUrl && (
          <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
        )}

        {/* Actions: Like, Comment, Share, Add */}
        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <IconButton
              icon={isLiked ? 'heart' : 'heart-outline'}
              iconColor={isLiked ? '#EF4444' : '#1E293B'}
              size={26}
              onPress={() => handleLike(meal.id)}
            />
            <IconButton
              icon="comment-outline"
              size={26}
              onPress={() => toggleComments(meal.id)}
            />
            <IconButton
              icon="share-outline"
              size={26}
              onPress={() => handleShare(meal)}
            />
          </View>
          <IconButton
            icon="plus-circle-outline"
            iconColor="#6366F1"
            size={26}
            onPress={() => handleCopyMeal(meal)}
          />
        </View>

        {/* Like count */}
        {likesCount > 0 && (
          <Text style={styles.likesText}>
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </Text>
        )}

        {/* Engagement Stats */}
        {(meal.copiedBy?.includes(user.uid) || meal.copiedByCount > 0) && (
          <View style={styles.engagementStats}>
            {meal.copiedBy?.includes(user.uid) && (
              <View style={styles.engagementBadge}>
                <IconButton icon="check-circle" size={14} iconColor="#10B981" style={styles.engagementIcon} />
                <Text style={styles.engagementText}>You added this</Text>
              </View>
            )}
            {meal.copiedByCount > 0 && (
              <View style={styles.engagementBadge}>
                <IconButton icon="account-multiple" size={14} iconColor="#6366F1" style={styles.engagementIcon} />
                <Text style={styles.engagementText}>
                  Added {meal.copiedByCount} {meal.copiedByCount === 1 ? 'time' : 'times'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Meal content */}
        <View style={styles.cardContent}>
          <Text style={styles.description}>
            <Text style={styles.userNameInline}>{meal.userName} </Text>
            {meal.description}
          </Text>

          {/* Nutrition summary */}
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionBadge}>
              <Text style={styles.nutritionValue}>{meal.totals.calories}</Text>
              <Text style={styles.nutritionLabel}>cal</Text>
            </View>
            <View style={styles.nutritionBadge}>
              <Text style={styles.nutritionValue}>{Math.round(meal.totals.protein)}</Text>
              <Text style={styles.nutritionLabel}>protein</Text>
            </View>
            <View style={styles.nutritionBadge}>
              <Text style={styles.nutritionValue}>{Math.round(meal.totals.carbs)}</Text>
              <Text style={styles.nutritionLabel}>carbs</Text>
            </View>
            <View style={styles.nutritionBadge}>
              <Text style={styles.nutritionValue}>{Math.round(meal.totals.fat)}</Text>
              <Text style={styles.nutritionLabel}>fat</Text>
            </View>
          </View>

          {/* View comments button */}
          {commentsCount > 0 && !commentsVisible && (
            <TouchableOpacity onPress={() => toggleComments(meal.id)}>
              <Text style={styles.viewCommentsText}>
                View {commentsCount === 1 ? '1 comment' : `all ${commentsCount} comments`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Comments section */}
          {commentsVisible && meal.comments && meal.comments.length > 0 && (
            <View style={styles.commentsSection}>
              {meal.comments.map((comment, index) => (
                <View key={index} style={styles.commentRow}>
                  <Text style={styles.commentText}>
                    <Text style={styles.commentUserName}>{comment.userName} </Text>
                    {comment.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Add comment input */}
          <View style={styles.addCommentRow}>
            <RNTextInput
              placeholder="Add a comment..."
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
                <Text style={styles.postButton}>Post</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Calendar Ribbon */}
      <Surface style={styles.calendarRibbon} elevation={2}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContent}
          ref={calendarRef}
        >
          {days.map((day, index) => {
            const { day: dayName, date } = formatDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected
                ]}
                onPress={() => handleDateSelect(day)}
              >
                <Text
                  style={[
                    styles.dayName,
                    isSelected && styles.dayNameSelected
                  ]}
                >
                  {dayName}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                    isToday && !isSelected && styles.todayDate
                  ]}
                >
                  {date}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Surface>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {feedMeals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.emptyText}>
                Add connections in your profile to see their meals here!
              </Text>
            </Card.Content>
          </Card>
        ) : (
          feedMeals.map(renderMealCard)
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
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text style={styles.modalTitle}>Add to My Day</Text>
              <Text style={styles.modalSubtitle}>Which meal type?</Text>

              <View style={styles.mealTypeChips}>
                {MEAL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    mode="outlined"
                    onPress={() => confirmCopyMeal(type)}
                    style={styles.mealTypeChip}
                  >
                    {type}
                  </Chip>
                ))}
              </View>

              <Button
                mode="text"
                onPress={() => setMealTypeDialogVisible(false)}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </Card.Content>
          </Card>
        </Modal>

        {/* Success/Error Snackbar */}
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
    backgroundColor: '#F1F5F9'
  },
  scrollContent: {
    paddingVertical: 8
  },
  mealCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    position: 'relative',
    overflow: 'visible',
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    backgroundColor: '#6366F1'
  },
  userNameContainer: {
    marginLeft: 12
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1E293B'
  },
  mealTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  mealImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#F1F5F9'
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  likesText: {
    paddingHorizontal: 16,
    fontWeight: '700',
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 8
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
    marginBottom: 12
  },
  userNameInline: {
    fontWeight: '700'
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12
  },
  nutritionBadge: {
    alignItems: 'center',
    flex: 1
  },
  nutritionValue: {
    fontWeight: '700',
    fontSize: 16,
    color: '#6366F1'
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  viewCommentsText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 8
  },
  commentsSection: {
    marginBottom: 12
  },
  commentRow: {
    marginBottom: 6
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#1E293B'
  },
  commentUserName: {
    fontWeight: '700'
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  postButton: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 12
  },
  emptyCard: {
    margin: 20,
    marginTop: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  emptyIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22
  },
  menuOverlay: {
    position: 'absolute',
    top: 40,
    right: 8,
    zIndex: 1000
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 220,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 8,
      }
    }),
  },
  menuItem: {
    padding: 16
  },
  menuText: {
    fontSize: 15,
    color: '#1E293B'
  },
  menuTextDanger: {
    color: '#EF4444'
  },
  modalContainer: {
    padding: 20
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center'
  },
  mealTypeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16
  },
  mealTypeChip: {
    marginBottom: 8
  },
  cancelButton: {
    marginTop: 8
  },
  snackbar: {
    backgroundColor: '#1E293B'
  },
  // Calendar Ribbon Styles
  calendarRibbon: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  calendarContent: {
    paddingHorizontal: 8
  },
  dateItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    borderRadius: 12
  },
  dateItemSelected: {
    backgroundColor: '#6366F1'
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  dayNameSelected: {
    color: '#E0E7FF'
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B'
  },
  dateNumberSelected: {
    color: '#FFFFFF'
  },
  todayDate: {
    color: '#6366F1'
  },
  // Engagement Stats Styles
  engagementStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  engagementIcon: {
    margin: 0,
    marginRight: -4
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  }
});
