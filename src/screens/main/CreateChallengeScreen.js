import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { challengeService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';

const DURATION_OPTIONS = [7, 14, 30];

function PillOption({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <RNText style={[styles.pillLabel, selected && styles.pillLabelSelected]}>{label}</RNText>
    </TouchableOpacity>
  );
}

export default function CreateChallengeScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { t } = useLocalization();

  const [name, setName] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const displayName = userProfile?.name || user?.email?.split('@')[0] || 'User';

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('challenges.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const challengeId = await challengeService.createChallenge(user.uid, displayName, {
        name: name.trim(),
        durationDays
      });
      navigation.replace('ChallengeDetail', { challengeId });
    } catch (e) {
      console.error('Error creating challenge:', e);
      setError(t('challenges.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>{t('challenges.nameLabel')}</Text>
        <TextInput
          mode="outlined"
          value={name}
          onChangeText={setName}
          placeholder={t('challenges.namePlaceholder')}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />

        <Text style={styles.label}>{t('challenges.durationLabel')}</Text>
        <View style={styles.pillRow}>
          {DURATION_OPTIONS.map((days) => (
            <PillOption
              key={days}
              label={t('challenges.durationDays', { count: days })}
              selected={durationDays === days}
              onPress={() => setDurationDays(days)}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, saving && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.85}
        >
          <RNText style={styles.createButtonLabel}>
            {saving ? t('common.loading') : t('challenges.createButton')}
          </RNText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    ...shadows.card
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.faint,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  input: {
    backgroundColor: colors.surface
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8
  },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.subtle,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center'
  },
  pillSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted
  },
  pillLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 14
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    ...shadows.glow
  },
  createButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2
  }
});
