import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Share } from 'react-native';
import { Text, Card, Button, TextInput, List, IconButton, Divider, Switch } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { userService, socialService } from '../../services/firebase';

export default function ProfileScreen({ navigation }) {
  const { user, refreshUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [shareCode, setShareCode] = useState('');
  const [newConnectionCode, setNewConnectionCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // Nutrition targets state
  const [editingTargets, setEditingTargets] = useState(false);
  const [weekdayCalories, setWeekdayCalories] = useState('');
  const [weekendCalories, setWeekendCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    loadProfile();
    loadConnections();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await userService.getUserProfile(user.uid);
      if (profile) {
        setUserProfile(profile);
        setShareCode(profile.personalCode || '');
        setIsPublic(profile.isPublic || false);

        // Load nutrition targets
        setWeekdayCalories(String(profile.weekdayCalories || profile.dailyCalorieTarget || '2000'));
        setWeekendCalories(String(profile.weekendCalories || profile.dailyCalorieTarget || '2000'));
        setProtein(String(profile.proteinTarget || '150'));
        setCarbs(String(profile.carbsTarget || '200'));
        setFat(String(profile.fatTarget || '65'));
      } else {
        console.log('No profile found, may need to create one');
        // Profile might not exist yet
        setShareCode('');
        setIsPublic(false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadConnections = async () => {
    try {
      const following = await socialService.getFollowingUsers(user.uid);
      setConnections(following || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnections([]);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(shareCode);
    showAlert('Copied!', 'Your share code has been copied to clipboard');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Calorie Tracker! Use my code: ${shareCode}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleAddConnection = async () => {
    if (!newConnectionCode.trim()) {
      showAlert('Error', 'Please enter a share code');
      return;
    }

    setLoading(true);
    try {
      await socialService.followUser(user.uid, newConnectionCode.toUpperCase());
      setNewConnectionCode('');
      await loadConnections();
      showAlert('Success', 'Connection added!');
    } catch (error) {
      console.error('Error adding connection:', error);
      showAlert('Error', error.message || 'Failed to add connection');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveConnection = (connection) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${connection.email || 'this user'}?`)) {
        removeConnection(connection.id);
      }
    } else {
      Alert.alert(
        'Remove Connection',
        `Remove ${connection.email || 'this user'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeConnection(connection.id)
          }
        ]
      );
    }
  };

  const removeConnection = async (userId) => {
    try {
      await socialService.unfollowUser(user.uid, userId);
      await loadConnections();
      showAlert('Success', 'Connection removed');
    } catch (error) {
      console.error('Error removing connection:', error);
      showAlert('Error', 'Failed to remove connection');
    }
  };

  const handleTogglePublic = async (value) => {
    setIsPublic(value);
    try {
      await userService.updateUserProfile(user.uid, { isPublic: value });
    } catch (error) {
      console.error('Error updating profile visibility:', error);
      setIsPublic(!value); // Revert on error
      showAlert('Error', 'Failed to update profile visibility');
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleEditTargets = () => {
    setEditingTargets(true);
  };

  const handleSaveTargets = async () => {
    try {
      await userService.updateUserProfile(user.uid, {
        weekdayCalories: parseInt(weekdayCalories),
        weekendCalories: parseInt(weekendCalories),
        dailyCalorieTarget: parseInt(weekdayCalories),
        proteinTarget: parseInt(protein),
        carbsTarget: parseInt(carbs),
        fatTarget: parseInt(fat),
      });
      await refreshUserProfile();
      setEditingTargets(false);
      showAlert('Success', 'Nutrition targets updated!');
    } catch (error) {
      console.error('Error updating targets:', error);
      showAlert('Error', 'Failed to update targets');
    }
  };

  const handleCancelEdit = () => {
    // Reset to current values
    if (userProfile) {
      setWeekdayCalories(String(userProfile.weekdayCalories || userProfile.dailyCalorieTarget || '2000'));
      setWeekendCalories(String(userProfile.weekendCalories || userProfile.dailyCalorieTarget || '2000'));
      setProtein(String(userProfile.proteinTarget || '150'));
      setCarbs(String(userProfile.carbsTarget || '200'));
      setFat(String(userProfile.fatTarget || '65'));
    }
    setEditingTargets(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Nutrition Targets Section */}
      {userProfile && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Nutrition Targets
              </Text>
              {!editingTargets && (
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={handleEditTargets}
                />
              )}
            </View>

            {editingTargets ? (
              <>
                <View style={styles.targetEditRow}>
                  <Text style={styles.targetLabel}>Weekday Calories:</Text>
                  <TextInput
                    value={weekdayCalories}
                    onChangeText={setWeekdayCalories}
                    keyboardType="number-pad"
                    style={styles.targetInput}
                    mode="outlined"
                    dense
                  />
                </View>

                {userProfile.enableWeekendFlexibility && (
                  <View style={styles.targetEditRow}>
                    <Text style={styles.targetLabel}>Weekend Calories:</Text>
                    <TextInput
                      value={weekendCalories}
                      onChangeText={setWeekendCalories}
                      keyboardType="number-pad"
                      style={styles.targetInput}
                      mode="outlined"
                      dense
                    />
                  </View>
                )}

                <View style={styles.targetEditRow}>
                  <Text style={styles.targetLabel}>Protein (g):</Text>
                  <TextInput
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="number-pad"
                    style={styles.targetInput}
                    mode="outlined"
                    dense
                  />
                </View>

                <View style={styles.targetEditRow}>
                  <Text style={styles.targetLabel}>Carbs (g):</Text>
                  <TextInput
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="number-pad"
                    style={styles.targetInput}
                    mode="outlined"
                    dense
                  />
                </View>

                <View style={styles.targetEditRow}>
                  <Text style={styles.targetLabel}>Fat (g):</Text>
                  <TextInput
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="number-pad"
                    style={styles.targetInput}
                    mode="outlined"
                    dense
                  />
                </View>

                <View style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={handleCancelEdit}
                    style={styles.halfButton}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveTargets}
                    style={styles.halfButton}
                  >
                    Save
                  </Button>
                </View>
              </>
            ) : (
              <>
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>Weekday Calories:</Text>
                  <Text style={styles.targetValue}>{weekdayCalories} cal</Text>
                </View>

                {userProfile.enableWeekendFlexibility && (
                  <View style={styles.targetRow}>
                    <Text style={styles.targetLabel}>Weekend Calories:</Text>
                    <Text style={styles.targetValue}>{weekendCalories} cal</Text>
                  </View>
                )}

                <Divider style={styles.targetDivider} />

                <View style={styles.macrosGrid}>
                  <View style={styles.macroItem}>
                    <View style={[styles.macroIndicator, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.macroLabel}>Protein</Text>
                    <Text style={styles.macroValue}>{protein}g</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <View style={[styles.macroIndicator, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.macroLabel}>Carbs</Text>
                    <Text style={styles.macroValue}>{carbs}g</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <View style={[styles.macroIndicator, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.macroLabel}>Fat</Text>
                    <Text style={styles.macroValue}>{fat}g</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Share Code Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your Share Code
          </Text>
          <Text variant="bodySmall" style={styles.helpText}>
            Share this code with friends and family so they can connect with you
          </Text>

          <View style={styles.shareCodeContainer}>
            <Text variant="headlineMedium" style={styles.shareCodeText}>
              {shareCode || 'Loading...'}
            </Text>
          </View>

          {!shareCode && (
            <Text variant="bodySmall" style={styles.warningText}>
              If your code doesn't appear, try logging a meal first to initialize your profile.
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={copyToClipboard}
              style={styles.halfButton}
              icon="content-copy"
            >
              Copy
            </Button>
            <Button
              mode="contained"
              onPress={handleShare}
              style={styles.halfButton}
              icon="share"
            >
              Share
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Profile Visibility Section */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Public Profile
              </Text>
              <Text variant="bodySmall" style={styles.helpText}>
                {isPublic
                  ? 'Anyone can discover and follow you'
                  : 'Only people with your share code can connect'}
              </Text>
            </View>
            <Switch value={isPublic} onValueChange={handleTogglePublic} />
          </View>
        </Card.Content>
      </Card>

      {/* Add Connection Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Add Connection
          </Text>
          <Text variant="bodySmall" style={styles.helpText}>
            Enter someone's share code to see their meals
          </Text>

          <TextInput
            label="Share Code"
            value={newConnectionCode}
            onChangeText={setNewConnectionCode}
            mode="outlined"
            placeholder="FIT-XXXXX"
            autoCapitalize="characters"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleAddConnection}
            loading={loading}
            disabled={loading}
            style={styles.addButton}
          >
            Add Connection
          </Button>
        </Card.Content>
      </Card>

      {/* Connections List */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            My Connections ({connections.length})
          </Text>

          {connections.length === 0 ? (
            <Text variant="bodyMedium" style={styles.emptyText}>
              No connections yet. Add someone using their share code!
            </Text>
          ) : (
            connections.map((connection) => (
              <View key={connection.id}>
                <List.Item
                  title={connection.email || 'User'}
                  description={`Code: ${connection.personalCode}`}
                  left={(props) => <List.Icon {...props} icon="account" />}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="delete"
                      iconColor="#EF4444"
                      onPress={() => handleRemoveConnection(connection)}
                    />
                  )}
                />
                <Divider />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 20
  },
  title: {
    marginBottom: 20,
    fontWeight: '700',
    fontSize: 24,
    color: '#1E293B',
    letterSpacing: -0.5
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 18,
    color: '#1E293B',
    letterSpacing: -0.3
  },
  helpText: {
    marginBottom: 20,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20
  },
  shareCodeContainer: {
    backgroundColor: '#F8FAFC',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed'
  },
  shareCodeText: {
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 3,
    fontSize: 28
  },
  warningText: {
    textAlign: 'center',
    color: '#EF4444',
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  halfButton: {
    flex: 1
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF'
  },
  addButton: {
    marginTop: 8
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    padding: 24,
    fontSize: 15,
    lineHeight: 22
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  targetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569'
  },
  targetValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1'
  },
  targetDivider: {
    marginVertical: 16
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  macroItem: {
    alignItems: 'center',
    gap: 8
  },
  macroIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase'
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B'
  },
  targetEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  targetInput: {
    flex: 1,
    marginLeft: 16,
    maxWidth: 120
  }
});
