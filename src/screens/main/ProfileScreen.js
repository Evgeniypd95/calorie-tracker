import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Share, TouchableOpacity, Modal } from 'react-native';
import { Text, Button, TextInput, IconButton, Icon, Switch } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { userService, socialService, authService } from '../../services/firebase';
import { useLocalization } from '../../localization/i18n';
import { colors, radius, shadows, type } from '../../theme';
import { GradientAvatar, Stat } from '../../components/ui';
import { getEffectiveStreak } from '../../utils/streak';

export default function ProfileScreen({ navigation }) {
  const { user, userProfile: authProfile } = useAuth();
  const { t } = useLocalization();

  const [shareCode, setShareCode] = useState('');
  const [newConnectionCode, setNewConnectionCode] = useState('');
  const [connections, setConnections] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [peopleModalVisible, setPeopleModalVisible] = useState(false);

  useEffect(() => {
    if (authProfile) {
      loadSocialData();
    }
  }, [authProfile]);

  const loadSocialData = async () => {
    try {
      setShareCode(authProfile.personalCode || '');
      setIsPublic(authProfile.isPublic || false);

      const following = await socialService.getFollowingUsers(user.uid);
      setConnections(following || []);

      const followerProfiles = await socialService.getUserProfilesByIds(authProfile.followers || []);
      setFollowers(followerProfiles);
    } catch (error) {
      console.error('Error loading social data:', error);
      setConnections([]);
      setFollowers([]);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(shareCode);
    showAlert(t('profile.copiedTitle'), t('profile.copiedMessage'));
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t('profile.shareMessage', { code: shareCode }),
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleAddConnection = async () => {
    if (!newConnectionCode.trim()) {
      showAlert(t('common.error'), t('profile.enterShareCode'));
      return;
    }

    setLoading(true);
    try {
      await socialService.followUser(user.uid, newConnectionCode.toUpperCase());
      setNewConnectionCode('');
      await loadSocialData();
      showAlert(t('common.success'), t('profile.connectionAdded'));
    } catch (error) {
      console.error('Error adding connection:', error);
      showAlert(t('common.error'), error.message || t('profile.addConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveConnection = (connection) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.removeConfirm', { name: connection.email || t('profile.user') }))) {
        removeConnection(connection.id);
      }
    } else {
      Alert.alert(
        t('profile.removeConnectionTitle'),
        t('profile.removeConfirm', { name: connection.email || t('profile.user') }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile.remove'),
            style: 'destructive',
            onPress: () => removeConnection(connection.id)
          }
        ]
      );
    }
  };

  const removeConnection = async (userId) => {
    try {
      await socialService.unfollowUser(user.uid, userId);
      await loadSocialData();
      showAlert(t('common.success'), t('profile.connectionRemoved'));
    } catch (error) {
      console.error('Error removing connection:', error);
      showAlert(t('common.error'), t('profile.removeConnectionFailed'));
    }
  };

  const handleTogglePublic = async (value) => {
    setIsPublic(value);
    try {
      await userService.updateUserProfile(user.uid, { isPublic: value });
    } catch (error) {
      console.error('Error updating profile visibility:', error);
      setIsPublic(!value);
      showAlert(t('common.error'), t('profile.updateVisibilityFailed'));
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const displayName = authProfile?.name || user?.email?.split('@')[0] || t('profile.user');
  const streak = getEffectiveStreak(authProfile);
  const followingCount = authProfile?.following?.length || 0;
  const followersCount = authProfile?.followers?.length || 0;

  const renderPersonRow = (person, key) => {
    const personName = person.name || person.email?.split('@')[0] || t('profile.user');
    return (
      <View key={key} style={styles.connectionRow}>
        <GradientAvatar name={personName} size={36} />
        <View style={styles.connectionInfo}>
          <Text style={styles.connectionName}>{personName}</Text>
          {person.personalCode && (
            <Text style={styles.connectionCode}>
              {t('profile.codeLabel', { code: person.personalCode })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Identity header */}
      <View style={styles.identityCard}>
        <GradientAvatar name={displayName} size={72} />
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.statsRow}>
          <Stat value={`🔥 ${streak}`} label={t('profile.streak')} color={colors.flame} />
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statTouchable} onPress={() => setPeopleModalVisible(true)}>
            <Stat value={followingCount} label={t('profile.following')} />
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statTouchable} onPress={() => setPeopleModalVisible(true)}>
            <Stat value={followersCount} label={t('profile.followers')} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Following / Followers modal */}
      <Modal
        visible={peopleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPeopleModalVisible(false)}
      >
        <View style={styles.peopleOverlay}>
          <View style={styles.peopleSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.peopleSectionTitle}>
                {t('profile.following')} ({connections.length})
              </Text>
              {connections.length === 0 ? (
                <Text style={styles.emptyText}>{t('profile.noConnections')}</Text>
              ) : (
                connections.map((person, i) => renderPersonRow(person, `f-${person.id || i}`))
              )}

              <Text style={[styles.peopleSectionTitle, { marginTop: 16 }]}>
                {t('profile.followers')} ({followers.length})
              </Text>
              {followers.length === 0 ? (
                <Text style={styles.emptyText}>{t('profile.noConnections')}</Text>
              ) : (
                followers.map((person, i) => renderPersonRow(person, `r-${person.id || i}`))
              )}
            </ScrollView>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              style={{ borderRadius: radius.pill, marginTop: 12 }}
              onPress={() => setPeopleModalVisible(false)}
            >
              {t('common.close')}
            </Button>
          </View>
        </View>
      </Modal>

      {/* Daily plan */}
      {authProfile?.dailyCalorieTarget && (
        <TouchableOpacity
          onPress={() => navigation.navigate('BodyMetrics')}
          activeOpacity={0.7}
        >
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planLabel}>{t('profile.dailyTarget')}</Text>
                <View style={styles.planValueRow}>
                  <Text style={styles.planCalories}>{authProfile.dailyCalorieTarget}</Text>
                  <Text style={styles.planUnit}>{t('profile.caloriesPerDay')}</Text>
                </View>
              </View>
              <View style={styles.planEditBadge}>
                <Icon source="pencil-outline" size={18} color={colors.primary} />
              </View>
            </View>

            <View style={styles.planMacros}>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.protein }]} />
                <Text style={styles.planMacroLabel}>{t('profile.protein')}</Text>
                <Text style={styles.planMacroValue}>{authProfile.proteinTarget}g</Text>
              </View>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.carbs }]} />
                <Text style={styles.planMacroLabel}>{t('profile.carbs')}</Text>
                <Text style={styles.planMacroValue}>{authProfile.carbsTarget}g</Text>
              </View>
              <View style={styles.planMacro}>
                <View style={[styles.planMacroDot, { backgroundColor: colors.fat }]} />
                <Text style={styles.planMacroLabel}>{t('profile.fat')}</Text>
                <Text style={styles.planMacroValue}>{authProfile.fatTarget}g</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Share code */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.shareCodeTitle')}</Text>
        <Text style={styles.helpText}>{t('profile.shareCodeSubtitle')}</Text>

        <View style={styles.shareCodeContainer}>
          <Text style={styles.shareCodeText}>
            {shareCode || t('profile.shareCodeLoading')}
          </Text>
        </View>

        {!shareCode && (
          <Text style={styles.warningText}>{t('profile.shareCodeWarning')}</Text>
        )}

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={copyToClipboard}
            style={styles.halfButton}
            textColor={colors.primary}
            icon="content-copy"
          >
            {t('profile.copy')}
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.primary}
            onPress={handleShare}
            style={styles.halfButton}
            icon="share-variant-outline"
          >
            {t('profile.share')}
          </Button>
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.sectionTitle}>{t('profile.publicProfile')}</Text>
            <Text style={styles.helpTextTight}>
              {isPublic ? t('profile.publicOn') : t('profile.publicOff')}
            </Text>
          </View>
          <Switch value={isPublic} onValueChange={handleTogglePublic} color={colors.primary} />
        </View>
      </View>

      {/* Add connection */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.addConnection')}</Text>
        <Text style={styles.helpText}>{t('profile.addConnectionSubtitle')}</Text>

        <TextInput
          label={t('profile.shareCodeLabel')}
          value={newConnectionCode}
          onChangeText={setNewConnectionCode}
          mode="outlined"
          placeholder={t('profile.shareCodePlaceholder')}
          autoCapitalize="characters"
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          style={styles.input}
        />

        <Button
          mode="contained"
          buttonColor={colors.primary}
          onPress={handleAddConnection}
          loading={loading}
          disabled={loading}
          style={styles.addButton}
        >
          {t('profile.addConnectionButton')}
        </Button>
      </View>

      {/* Connections */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t('profile.connectionsTitle', { count: connections.length })}
        </Text>

        {connections.length === 0 ? (
          <Text style={styles.emptyText}>{t('profile.noConnections')}</Text>
        ) : (
          connections.map((connection, index) => {
            const connectionName = connection.name || connection.email?.split('@')[0] || t('profile.user');
            return (
              <View key={connection.id}>
                <View style={styles.connectionRow}>
                  <GradientAvatar name={connectionName} size={40} />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>{connectionName}</Text>
                    <Text style={styles.connectionCode}>
                      {t('profile.codeLabel', { code: connection.personalCode })}
                    </Text>
                  </View>
                  <IconButton
                    icon="account-remove-outline"
                    size={20}
                    iconColor={colors.faint}
                    onPress={() => handleRemoveConnection(connection)}
                  />
                </View>
                {index < connections.length - 1 && <View style={styles.connectionDivider} />}
              </View>
            );
          })
        )}
      </View>

      {/* Log out */}
      <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
        <Icon source="logout" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>{t('profile.logOut')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16
  },
  identityCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: 16,
    ...shadows.card
  },
  displayName: {
    ...type.title,
    marginTop: 12
  },
  email: {
    ...type.caption,
    marginTop: 2
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.subtle,
    alignSelf: 'stretch'
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border
  },
  statTouchable: {
    flex: 1
  },
  peopleOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end'
  },
  peopleSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 32,
    maxHeight: '75%'
  },
  peopleSectionTitle: {
    ...type.overline,
    marginBottom: 8
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.tintBorder,
    ...shadows.card
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  planLabel: {
    ...type.overline,
    marginBottom: 6
  },
  planValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6
  },
  planCalories: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1.5
  },
  planUnit: {
    fontSize: 13,
    color: colors.muted
  },
  planEditBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  planMacros: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.subtle
  },
  planMacro: {
    flex: 1,
    alignItems: 'center'
  },
  planMacroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6
  },
  planMacroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  planMacroValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3
  },
  card: {
    marginBottom: 16,
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  sectionTitle: {
    ...type.heading,
    marginBottom: 6
  },
  shareCodeContainer: {
    backgroundColor: colors.tint,
    padding: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.tintBorder,
    borderStyle: 'dashed'
  },
  shareCodeText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3
  },
  helpText: {
    ...type.caption,
    lineHeight: 19,
    marginBottom: 8
  },
  helpTextTight: {
    ...type.caption,
    lineHeight: 19
  },
  warningText: {
    color: colors.warning,
    fontStyle: 'italic',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 12
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  halfButton: {
    flex: 1,
    borderRadius: radius.pill
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16
  },
  input: {
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: colors.surface
  },
  addButton: {
    borderRadius: radius.pill
  },
  emptyText: {
    ...type.caption,
    color: colors.faint,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12
  },
  connectionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink
  },
  connectionCode: {
    fontSize: 12,
    color: colors.faint,
    marginTop: 1
  },
  connectionDivider: {
    height: 1,
    backgroundColor: colors.subtle,
    marginLeft: 52
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger
  }
});
