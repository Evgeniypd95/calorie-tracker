import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, Card, Chip } from 'react-native-paper';
import { socialService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function SocialScreen() {
  const { user } = useAuth();
  const [personalCode, setPersonalCode] = useState('');
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFollowing();
  }, []);

  const loadFollowing = async () => {
    try {
      const followingData = await socialService.getFollowingUsers(user.uid);
      setFollowing(followingData);
    } catch (error) {
      console.error('Error loading following:', error);
    }
  };

  const handleFollow = async () => {
    if (!personalCode.trim()) {
      alert('Please enter a personal code');
      return;
    }

    setLoading(true);
    try {
      await socialService.followUser(user.uid, personalCode.toUpperCase());
      alert('Successfully followed user!');
      setPersonalCode('');
      await loadFollowing();
    } catch (error) {
      console.error('Error following user:', error);
      alert('Failed to follow user. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Follow Friends
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Add a Friend
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Enter your friend's personal code to follow their progress
          </Text>

          <TextInput
            label="Personal Code"
            value={personalCode}
            onChangeText={setPersonalCode}
            mode="outlined"
            placeholder="FIT-XXXXX"
            autoCapitalize="characters"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleFollow}
            loading={loading}
            disabled={loading}
          >
            Follow
          </Button>
        </Card.Content>
      </Card>

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Following
      </Text>

      {following.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.emptyText}>
              You're not following anyone yet. Add friends to see their progress!
            </Text>
          </Card.Content>
        </Card>
      ) : (
        following.map((friend) => (
          <Card key={friend.id} style={styles.friendCard}>
            <Card.Content>
              <View style={styles.friendHeader}>
                <View>
                  <Text variant="titleMedium">{friend.email}</Text>
                  <Text variant="bodySmall" style={styles.personalCode}>
                    {friend.personalCode}
                  </Text>
                </View>
                <Chip icon="fire">
                  {friend.streakCount || 0} days
                </Chip>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold'
  },
  card: {
    marginBottom: 16
  },
  cardTitle: {
    marginBottom: 8
  },
  description: {
    marginBottom: 16,
    color: '#666'
  },
  input: {
    marginBottom: 16
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 16
  },
  emptyText: {
    textAlign: 'center',
    color: '#666'
  },
  friendCard: {
    marginBottom: 12
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  personalCode: {
    color: '#666',
    marginTop: 4
  }
});
