import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const { signOut } = useAuth();

  useEffect(() => {
    // Fade in main content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignIn = async () => {
    // User wants to sign in with different account
    await signOut();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🍽️</Text>
          <Text style={styles.title}>Track nutrition{'\n'}in seconds</Text>
          <Text style={styles.subtitle}>AI-powered tracking that actually works</Text>
        </View>

        {/* Video Placeholder */}
        <View style={styles.videoContainer}>
          <View style={styles.phoneMockup}>
            <View style={styles.phoneScreen}>
              <Text style={styles.videoPlaceholder}>📹</Text>
              <Text style={styles.videoText}>Demo Video Coming Soon</Text>
            </View>
          </View>
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🎤</Text>
            <Text style={styles.featureText}>Voice logging</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>📸</Text>
            <Text style={styles.featureText}>Photo scanning</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={styles.featureText}>Chat with AI</Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('GoalSelection')}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Continue
          </Button>
          <TouchableOpacity onPress={handleSignIn} style={styles.signInButton}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
  },
  videoContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  phoneMockup: {
    width: 280,
    height: 480,
    backgroundColor: '#1E293B',
    borderRadius: 32,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    fontSize: 80,
    marginBottom: 16,
  },
  videoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: '100%',
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  signInButton: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 15,
    color: '#6366F1',
    fontWeight: '600',
  },
});
