import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Share } from 'react-native';
import { Text, Card, Button, TextInput, List, IconButton, Divider } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { userService, socialService } from '../../services/firebase';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [shareCode, setShareCode] = useState('');
  const [newConnectionCode, setNewConnectionCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);

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
      } else {
        console.log('No profile found, may need to create one');
        // Profile might not exist yet
        setShareCode('');
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

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  return (
    <ScrollView style={styles.container}>
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
  }
});
