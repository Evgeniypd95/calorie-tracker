import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Share, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, Divider, List, IconButton, Switch, useTheme } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { userService, socialService } from '../../services/firebase';

export default function ProfileScreen({ navigation }) {
  const { user, userProfile: authProfile } = useAuth();
  const theme = useTheme();

  // Social features
  const [shareCode, setShareCode] = useState('');
  const [newConnectionCode, setNewConnectionCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authProfile) {
      loadSocialData();
    }
  }, [authProfile]);

  const loadSocialData = async () => {
    try {
      setShareCode(authProfile.personalCode || '');
      setIsPublic(authProfile.isPublic || false);

      const following = await socialService.getFollowingUsers(user.uid);
      setConnections(following || []);
    } catch (error) {
      console.error('Error loading social data:', error);
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
      await loadSocialData();
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
      await loadSocialData();
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
      setIsPublic(!value);
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

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.pageTitle}>
        My Profile
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Manage your nutrition plan and connections
      </Text>

      {/* Compact Personalized Plan Card */}
      {authProfile?.dailyCalorieTarget && (
        <TouchableOpacity
          onPress={() => navigation.navigate('BodyMetrics')}
          activeOpacity={0.7}
        >
          <Card style={styles.compactPlanCard} elevation={2}>
            <Card.Content>
              <View style={styles.compactPlanHeader}>
                <View>
                  <Text variant="labelSmall" style={styles.compactPlanLabel}>
                    YOUR DAILY TARGET
                  </Text>
                  <Text variant="headlineLarge" style={styles.compactPlanCalories}>
                    {authProfile.dailyCalorieTarget}
                  </Text>
                  <Text variant="bodySmall" style={styles.compactPlanUnit}>
                    calories/day
                  </Text>
                </View>
                <IconButton
                  icon="pencil"
                  size={24}
                  iconColor="#6366F1"
                  style={styles.editButton}
                  onPress={() => navigation.navigate('BodyMetrics')}
                />
              </View>

              <Divider style={styles.compactDivider} />

              <View style={styles.compactMacrosRow}>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#EF4444' }]} />
                  <Text variant="labelSmall" style={styles.compactMacroLabel}>
                    Protein
                  </Text>
                  <Text variant="titleMedium" style={styles.compactMacroValue}>
                    {authProfile.proteinTarget}g
                  </Text>
                </View>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#10B981' }]} />
                  <Text variant="labelSmall" style={styles.compactMacroLabel}>
                    Carbs
                  </Text>
                  <Text variant="titleMedium" style={styles.compactMacroValue}>
                    {authProfile.carbsTarget}g
                  </Text>
                </View>
                <View style={styles.compactMacro}>
                  <View style={[styles.compactMacroBar, { backgroundColor: '#F59E0B' }]} />
                  <Text variant="labelSmall" style={styles.compactMacroLabel}>
                    Fat
                  </Text>
                  <Text variant="titleMedium" style={styles.compactMacroValue}>
                    {authProfile.fatTarget}g
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      )}

      {/* Share Code Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            🔗 Your Share Code
          </Text>
          <Text variant="bodySmall" style={styles.helpText}>
            Share this code with friends so they can connect with you
          </Text>

          <View style={styles.shareCodeContainer}>
            <Text variant="headlineMedium" style={styles.shareCodeText}>
              {shareCode || 'Loading...'}
            </Text>
          </View>

          {!shareCode && (
            <Text variant="bodySmall" style={styles.warningText}>
              If your code doesn't appear, try restarting the app.
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
                🌐 Public Profile
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
          <Text variant="titleLarge" style={styles.sectionTitle}>
            ➕ Add Connection
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
          <Text variant="titleLarge" style={styles.sectionTitle}>
            👥 My Connections ({connections.length})
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
  pageTitle: {
    marginBottom: 8,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -1
  },
  subtitle: {
    marginBottom: 24,
    color: '#64748B'
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  compactPlanCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6366F1',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(99, 102, 241, 0.15)',
      },
    }),
  },
  compactPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  compactPlanLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    color: '#64748B'
  },
  compactPlanCalories: {
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 4,
    color: '#6366F1'
  },
  compactPlanUnit: {
    fontSize: 13,
    color: '#64748B'
  },
  editButton: {
    margin: 0,
    marginTop: -8
  },
  compactDivider: {
    marginBottom: 16
  },
  compactMacrosRow: {
    flexDirection: 'row',
    gap: 12
  },
  compactMacro: {
    flex: 1,
    alignItems: 'center'
  },
  compactMacroBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginBottom: 8
  },
  compactMacroLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    color: '#64748B'
  },
  compactMacroValue: {
    fontWeight: '700',
    color: '#1E293B'
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5
  },
  shareCodeContainer: {
    backgroundColor: '#F8FAFC',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  shareCodeText: {
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 2
  },
  helpText: {
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20
  },
  warningText: {
    color: '#F59E0B',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  halfButton: {
    flex: 1
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  input: {
    marginBottom: 16
  },
  addButton: {
    marginTop: 8
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16
  }
});
