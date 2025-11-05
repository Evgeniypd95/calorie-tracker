import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity, TextInput as RNTextInput, Platform } from 'react-native';
import { Text, Card, IconButton, Surface, Divider, Avatar, Button, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { socialService, mealService } from '../../services/firebase';

export default function SocialFeedScreen({ navigation }) {
  const { user } = useAuth();
  const [feedMeals, setFeedMeals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [showComments, setShowComments] = useState({});

  const loadFeed = async () => {
    try {
      const meals = await socialService.getSocialFeed(user.uid, 20);
      setFeedMeals(meals);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

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

  const handleCopyMeal = async (meal) => {
    try {
      await socialService.copyMealToUser(user.uid, meal);
      // Could show a snackbar here
      console.log('Meal copied!');
    } catch (error) {
      console.error('Error copying meal:', error);
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
            onPress={() => {}}
          />
        </View>

        {/* Meal Photo (if exists) */}
        {meal.imageUrl && (
          <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
        )}

        {/* Actions: Like, Comment, Copy */}
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
              onPress={() => {}}
            />
          </View>
          <IconButton
            icon="bookmark-outline"
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
  }
});
