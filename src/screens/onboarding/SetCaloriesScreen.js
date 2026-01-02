import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { userService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLocalization } from '../../localization/i18n';

export default function SetCaloriesScreen({ navigation }) {
  const { user, refreshUserProfile } = useAuth();
  const { t } = useLocalization();
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !calories || !protein || !carbs || !fat) {
      alert(t('setTargets.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      await userService.updateUserProfile(user.uid, {
        name,
        dailyCalorieTarget: parseInt(calories),
        proteinTarget: parseInt(protein),
        carbsTarget: parseInt(carbs),
        fatTarget: parseInt(fat)
      });

      await refreshUserProfile();
    } catch (error) {
      console.error('Error saving targets:', error);
      alert(t('setTargets.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text variant="displaySmall" style={styles.title}>
            {t('setTargets.title')}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('setTargets.subtitle')}
          </Text>

          <TextInput
            label={t('setTargets.name')}
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label={t('setTargets.dailyCalories')}
            value={calories}
            onChangeText={setCalories}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            label={t('setTargets.protein')}
            value={protein}
            onChangeText={setProtein}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            label={t('setTargets.carbs')}
            value={carbs}
            onChangeText={setCarbs}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            label={t('setTargets.fat')}
            value={fat}
            onChangeText={setFat}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            {t('setTargets.saveContinue')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  title: {
    marginBottom: 12,
    fontWeight: '800',
    fontSize: 36,
    color: '#1E293B',
    letterSpacing: -1
  },
  subtitle: {
    marginBottom: 40,
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF'
  },
  button: {
    marginTop: 12,
    paddingVertical: 8
  }
});
