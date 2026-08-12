import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../../../stores/authStore';
import { useFriends } from '../../../../lib/useFriends';
import { useGroupInvite, type InviteSheetMember } from '../../../../lib/useGroupInvite';
import { inviteLinkFor } from '../../../../lib/shareLinks';
import { linkBlurb, linkUnavailable } from '../../../../lib/groupDoor';
import { MIN_TOUCH_TARGET } from '../../../../lib/a11y';
import { ThemedText, Avatar, Button } from '../../../../components/ui';
import { colors, fonts, radii, spacing } from '../../../../theme/tokens';
import { shareInviteLink } from './index';

export default function InviteToGroupSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [picks, setPicks] = useState<string[]>([]);
  // The link that was copied, rather than a flag: resetting mints a new one,
  // and "Link copied ✓" over a link nobody has copied is a lie.
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { friends } = useFriends();
  const { group, rotate, sendInvites } = useGroupInvite(id);

  const members = (group?.group_members ?? []) as InviteSheetMember[];
  const memberIds = new Set(members.map((m) => m.user_id));
  const me = members.find((m) => m.user_id === user?.id);
  const isAdmin = me?.role === 'admin';
  const invitedIds = new Set(group?.pendingInviteeIds ?? []);
  const invitable = friends.filter((f) => !memberIds.has(f.id));
  const link = group?.inviteCode ? inviteLinkFor(group.inviteCode) : '';
  const copied = !!link && copiedLink === link;

  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    setCopiedLink(link);
  };

  const confirmReset = () =>
    Alert.alert(
      'Reset the invite link?',
      'The old link stops working right away. Anyone still holding it will need a new one from you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset link', style: 'destructive', onPress: () => rotate.mutate() },
      ]
    );

  const togglePick = (personId: string) =>
    setPicks((prev) =>
      prev.includes(personId) ? prev.filter((p) => p !== personId) : [...prev, personId]
    );

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.grabber} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <ThemedText variant="headerTitle">Add people to {group?.name ?? '…'}</ThemedText>
          <ThemedText variant="body" color={colors.textSecondary}>
            {linkBlurb(group?.join_mode)}
          </ThemedText>
        </View>

        {group && !group.inviteCode ? (
          <ThemedText variant="body" color={colors.textSecondary} testID="link-unavailable">
            {linkUnavailable(group.who_can_invite, me?.role)}
          </ThemedText>
        ) : (
          <View style={styles.linkCard}>
            <ThemedText style={styles.link}>{link}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={copyLink}
              style={[styles.copyButton, copied && styles.copyButtonDone]}
              testID="copy-link"
            >
              <ThemedText
                variant="bodyStrong"
                color={copied ? colors.confirmed : colors.background}
              >
                {copied ? 'Link copied ✓' : 'Copy link'}
              </ThemedText>
            </Pressable>
            {isAdmin ? (
              <Pressable
                accessibilityRole="button"
                disabled={rotate.isPending}
                onPress={confirmReset}
                style={styles.resetRow}
                testID="reset-link"
              >
                <ThemedText variant="bodyStrong" color={colors.textSecondary}>
                  {rotate.isPending ? 'Resetting…' : 'Reset link'}
                </ThemedText>
                <ThemedText variant="caption">Anyone still holding the old one is out</ThemedText>
              </Pressable>
            ) : null}
          </View>
        )}

        {invitable.length > 0 ? (
          <View style={styles.section}>
            <ThemedText variant="sectionLabel">Already on Planazo</ThemedText>
            <View style={styles.chipWrap}>
              {invitable.map((f) => {
                const invited = invitedIds.has(f.id);
                const picked = picks.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked, disabled: invited }}
                    disabled={invited}
                    onPress={() => togglePick(f.id)}
                    style={[
                      styles.chip,
                      picked && styles.chipPicked,
                      invited && styles.chipInvited,
                    ]}
                    testID={`invitee-${f.id}`}
                  >
                    <Avatar name={f.name} size={26} imageUrl={f.avatarUrl} />
                    <ThemedText
                      variant="bodyStrong"
                      color={
                        picked
                          ? colors.background
                          : invited
                            ? colors.textFaint
                            : colors.textPrimary
                      }
                      style={styles.chipLabel}
                    >
                      {f.name.split(' ')[0]}
                    </ThemedText>
                    <ThemedText
                      variant="tag"
                      color={picked ? colors.background : colors.textFaint}
                    >
                      {invited ? 'invited' : picked ? '✓' : '+'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {picks.length > 0 ? (
          <Button
            label={
              sendInvites.isPending
                ? 'Sending…'
                : `Send ${picks.length} invite${picks.length === 1 ? '' : 's'}`
            }
            disabled={sendInvites.isPending}
            onPress={() => sendInvites.mutate(picks)}
            testID="send-invites"
          />
        ) : (
          <Button
            label="Share the link instead"
            variant="secondary"
            disabled={!group?.inviteCode}
            onPress={() => group?.inviteCode && shareInviteLink(group.name, group.inviteCode)}
            testID="share-link"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginTop: 10,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 30,
    gap: spacing.xl,
  },
  titleBlock: {
    gap: 6,
  },
  linkCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  link: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.19,
    color: colors.textPrimary,
  },
  copyButton: {
    backgroundColor: colors.ink,
    borderRadius: radii.input,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyButtonDone: {
    backgroundColor: colors.confirmedSoft,
  },
  resetRow: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  section: {
    gap: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // 36 (7 + 19 + 7 + border) — one tap per person you are inviting (PLA-40).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 13,
  },
  chipPicked: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipInvited: {
    opacity: 0.6,
  },
  chipLabel: {
    fontSize: 15,
    lineHeight: 19,
  },
});
