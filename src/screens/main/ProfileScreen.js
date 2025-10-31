import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Divider } from 'react-native-paper';
import { authService, userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, userProfile } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadProfile();
  }, [userProfile]);

  const loadProfile = async () => {
    try {
      const data = await userService.getUserProfile(user.uid);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Profile
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Code
          </Text>
          <Text variant="displaySmall" style={styles.personalCode}>
            {profile.personalCode}
          </Text>
          <Text variant="bodySmall" style={styles.codeHint}>
            Share this code with friends so they can follow you
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Stats
          </Text>

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Current Streak:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.streakCount || 0} days
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Followers:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.followers?.length || 0}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Following:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.following?.length || 0}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Daily Budget
          </Text>

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Calories:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.dailyBudget.calories}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Protein:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.dailyBudget.protein}g
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Carbs:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.dailyBudget.carbs}g
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statRow}>
            <Text variant="bodyLarge">Fat:</Text>
            <Text variant="bodyLarge" style={styles.statValue}>
              {profile.dailyBudget.fat}g
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Account
          </Text>

          <Text variant="bodyMedium" style={styles.email}>
            {user.email}
          </Text>

          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor="#f44336"
          >
            Log Out
          </Button>
        </Card.Content>
      </Card>
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
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold'
  },
  personalCode: {
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
    marginVertical: 8
  },
  codeHint: {
    color: '#666',
    textAlign: 'center'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3'
  },
  divider: {
    marginVertical: 4
  },
  email: {
    color: '#666',
    marginBottom: 16
  },
  logoutButton: {
    marginTop: 8
  }
});
