import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, TextInput, Icon } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { challengeService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { GradientAvatar } from '../../components/ui';

export default function ChallengesScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { t } = useLocalization();

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [])
  );

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const data = await challengeService.getMyChallenges(user.uid);
      setChallenges(data);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  const displayName = userProfile?.name || user?.email?.split('@')[0] || 'User';

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setJoinError(t('challenges.enterCode'));
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      await challengeService.joinChallengeByCode(user.uid, displayName, joinCode.trim());
      setJoinCode('');
      await loadChallenges();
    } catch (error) {
      setJoinError(error.message || t('challenges.joinFailed'));
    } finally {
      setJoining(false);
    }
  };

  const isActive = (challenge) => {
    const endDate = challenge.endDate?.toDate ? challenge.endDate.toDate() : new Date(challenge.endDate);
    return endDate >= new Date();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.createRow}
        onPress={() => navigation.navigate('CreateChallenge')}
        activeOpacity={0.85}
      >
        <View style={styles.createIconWrap}>
          <Icon source="plus" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.createTitle}>{t('challenges.createTitle')}</Text>
          <Text style={styles.createSubtitle}>{t('challenges.createSubtitle')}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('challenges.joinTitle')}</Text>
        <View style={styles.joinRow}>
          <TextInput
            mode="outlined"
            value={joinCode}
            onChangeText={(text) => { setJoinCode(text); setJoinError(''); }}
            placeholder={t('challenges.codePlaceholder')}
            autoCapitalize="characters"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.joinInput}
            dense
          />
          <TouchableOpacity
            style={[styles.joinButton, joining && { opacity: 0.6 }]}
            onPress={handleJoin}
            disabled={joining}
            activeOpacity={0.85}
          >
            <RNText style={styles.joinButtonLabel}>{t('challenges.join')}</RNText>
          </TouchableOpacity>
        </View>
        {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
      </View>

      <Text style={styles.listTitle}>{t('challenges.myChallenges')}</Text>

      {loading ? (
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      ) : challenges.length === 0 ? (
        <View style={styles.emptyCard}>
          <RNText style={styles.emptyIcon}>🏆</RNText>
          <Text style={styles.emptyTitle}>{t('challenges.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('challenges.emptyBody')}</Text>
        </View>
      ) : (
        challenges.map((challenge) => {
          const memberCount = (challenge.memberIds || []).length;
          const active = isActive(challenge);
          return (
            <TouchableOpacity
              key={challenge.id}
              style={styles.challengeCard}
              onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
              activeOpacity={0.7}
            >
              <View style={styles.challengeCardTop}>
                <Text style={styles.challengeName}>{challenge.name}</Text>
                <View style={[styles.statusBadge, !active && styles.statusBadgeEnded]}>
                  <RNText style={[styles.statusBadgeText, !active && styles.statusBadgeTextEnded]}>
                    {active ? t('challenges.active') : t('challenges.ended')}
                  </RNText>
                </View>
              </View>
              <View style={styles.challengeCardBottom}>
                <View style={styles.avatarStack}>
                  {Object.values(challenge.members || {}).slice(0, 4).map((member, i) => (
                    <GradientAvatar
                      key={i}
                      name={member.name}
                      size={28}
                      style={{ marginLeft: i > 0 ? -8 : 0, borderWidth: 2, borderColor: colors.surface }}
                    />
                  ))}
                </View>
                <Text style={styles.memberCountText}>
                  {t('challenges.memberCount', { count: memberCount })}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.tintBorder,
    ...shadows.card
  },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  createTitle: {
    ...type.heading,
    fontSize: 15
  },
  createSubtitle: {
    ...type.caption,
    fontSize: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 20,
    ...shadows.card
  },
  sectionTitle: {
    ...type.heading,
    marginBottom: 12
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10
  },
  joinInput: {
    flex: 1,
    backgroundColor: colors.surface
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  joinButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 8
  },
  listTitle: {
    ...type.title,
    fontSize: 20,
    marginBottom: 12
  },
  emptyText: {
    ...type.caption,
    textAlign: 'center',
    paddingVertical: 20
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14
  },
  emptyTitle: {
    ...type.heading,
    fontSize: 19,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyBody: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center'
  },
  challengeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadows.card
  },
  challengeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
    marginRight: 10
  },
  statusBadge: {
    backgroundColor: colors.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  statusBadgeEnded: {
    backgroundColor: colors.subtle
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark
  },
  statusBadgeTextEnded: {
    color: colors.muted
  },
  challengeCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  avatarStack: {
    flexDirection: 'row'
  },
  memberCountText: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: '600'
  }
});
