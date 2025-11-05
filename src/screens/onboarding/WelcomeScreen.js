import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  const handleSignIn = () => {
    navigation.navigate('Login');
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  videoContainer: {
    alignItems: 'center',
  },
  phoneMockup: {
    width: 200,
    height: 320,
    backgroundColor: '#1E293B',
    borderRadius: 28,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    fontSize: 60,
    marginBottom: 12,
  },
  videoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  featuresContainer: {
    width: '100%',
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    width: '100%',
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  signInButton: {
    paddingVertical: 4,
  },
  signInText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
});
