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
                      iconColor="#ff4444"
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
    backgroundColor: '#f8f9fa',
    padding: 16
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold'
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff'
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold'
  },
  helpText: {
    marginBottom: 16,
    color: '#666'
  },
  shareCodeContainer: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  shareCodeText: {
    fontWeight: 'bold',
    color: '#2196F3',
    letterSpacing: 2
  },
  warningText: {
    textAlign: 'center',
    color: '#ff6b6b',
    marginTop: 8,
    fontStyle: 'italic'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  halfButton: {
    flex: 1
  },
  input: {
    marginBottom: 12
  },
  addButton: {
    marginTop: 4
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20
  }
});
