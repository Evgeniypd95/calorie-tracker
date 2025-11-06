import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="displayLarge" style={styles.title}>
          Welcome to{'\n'}Calorie Tracker
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your AI-powered nutrition coach
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('ConversationalOnboarding')}
            style={styles.button}
          >
            Get Started
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
          >
            Already have an account? Log In
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  title: {
    marginBottom: 12,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -1
  },
  subtitle: {
    marginBottom: 60,
    color: '#64748B',
    textAlign: 'center'
  },
  buttonContainer: {
    width: '100%',
    gap: 12
  },
  button: {
    paddingVertical: 8
  },
  linkButton: {
    marginTop: 12
  }
});
