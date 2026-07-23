import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, Alert, Platform } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { challengeService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { GradientAvatar } from '../../components/ui';

const RANK_COLORS = ['#F59E0B', '#94A3B8', '#B45309'];

export default function ChallengeDetailScreen({ route, navigation }) {
  const { challengeId } = route.params;
  const { user } = useAuth();
  const { t } = useLocalization();

  const [challenge, setChallenge] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadChallenge();
  }, [challengeId]);

  const loadChallenge = async () => {
    try {
      setLoading(true);
      const data = await challengeService.getChallengeById(challengeId);
      setChallenge(data);
      if (data) {
        const board = await challengeService.getChallengeLeaderboard(data);
        setLeaderboard(board);
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!challenge) return;
    await Clipboard.setStringAsync(challenge.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmLeave = () => {
    const doLeave = async () => {
      await challengeService.leaveChallenge(challengeId, user.uid);
      navigation.goBack();
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('challenges.leaveConfirm'))) doLeave();
    } else {
      Alert.alert(
        t('challenges.leaveTitle'),
        t('challenges.leaveConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('challenges.leave'), style: 'destructive', onPress: doLeave }
        ]
      );
    }
  };

  if (loading || !challenge) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const endDate = challenge.endDate?.toDate ? challenge.endDate.toDate() : new Date(challenge.endDate);
  const daysRemaining = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.challengeName}>{challenge.name}</Text>
        <Text style={styles.daysRemaining}>
          {daysRemaining > 0
            ? t('challenges.daysRemaining', { count: daysRemaining })
            : t('challenges.ended')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('challenges.leaderboard')}</Text>
        {leaderboard.map((entry, i) => (
          <View key={entry.userId} style={styles.leaderRow}>
            <View style={[styles.rankBadge, i < 3 && { backgroundColor: RANK_COLORS[i] }]}>
              <RNText style={[styles.rankText, i < 3 && { color: '#FFFFFF' }]}>{i + 1}</RNText>
            </View>
            <GradientAvatar name={entry.name} size={36} />
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>
                {entry.userId === user.uid ? t('common.you') : entry.name}
              </Text>
            </View>
            <Text style={styles.leaderScore}>
              {t('challenges.daysHit', { hit: entry.daysHit, total: entry.totalDays })}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('challenges.inviteTitle')}</Text>
        <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode} activeOpacity={0.7}>
          <RNText style={styles.codeText}>{challenge.inviteCode}</RNText>
          <Icon source={copied ? 'check' : 'content-copy'} size={18} color={colors.primary} />
        </TouchableOpacity>
        {copied && <Text style={styles.copiedText}>{t('challenges.copied')}</Text>}
      </View>

      <TouchableOpacity style={styles.leaveButton} onPress={confirmLeave} activeOpacity={0.7}>
        <Icon source="exit-to-app" size={18} color={colors.danger} />
        <Text style={styles.leaveButtonText}>{t('challenges.leave')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingText: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 60
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 16,
    ...shadows.card
  },
  challengeName: {
    ...type.title,
    marginBottom: 4
  },
  daysRemaining: {
    ...type.caption
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    ...shadows.card
  },
  sectionTitle: {
    ...type.heading,
    marginBottom: 14
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted
  },
  leaderInfo: {
    flex: 1
  },
  leaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink
  },
  leaderScore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.tint,
    borderWidth: 1,
    borderColor: colors.tintBorder,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 16
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3
  },
  copiedText: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger
  }
});
