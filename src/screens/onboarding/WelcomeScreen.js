import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useLocalization } from '../../localization/i18n';

export default function WelcomeScreen({ navigation }) {
  const { t } = useLocalization();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="displayLarge" style={styles.title}>
          {t('onboarding.welcomeTitle')}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {t('onboarding.welcomeSubtitle')}
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('OnboardingGoals')}
            style={styles.button}
          >
            {t('onboarding.getStarted')}
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
          >
            {t('onboarding.alreadyAccount')}
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
