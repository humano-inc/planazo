import { View, StyleSheet, Pressable } from 'react-native';
import { ForwardGlyph, ThemedText, Card } from '../ui';
import { PrefSwitchRow } from './PrefSwitchRow';
import { settingsStyles } from './settingsStyles';
import { memberLimits } from '../../lib/groupDoor';
import { colors } from '../../theme/tokens';

interface Props {
  /** Group-wide: off means only admins can post plans. Admins only. */
  anyoneCanPost: boolean;
  onAnyoneCanPost: (on: boolean) => void;
  anyoneCanPostPending: boolean;
  /** The invite dial, read only here: it is what a member is told about. */
  whoCanInvite: string | null | undefined;
  /** This user's own push preference for this group. */
  notify: boolean;
  onNotify: (on: boolean) => void;
  notifyPending: boolean;
  isAdmin: boolean;
  /** "Just you" or "N people run this group" — the Admins row's subtitle. */
  adminSummary: string;
  onEditProfile: () => void;
  onAdmins: () => void;
}

/**
 * "How it runs": what this person can actually change about the group.
 *
 * For an admin that is both switches and the two rows below them. For a member
 * it is their own notifications and nothing else, followed by whatever the
 * group's settings are keeping from them, said in a line rather than shown as a
 * switch they cannot move (PLA-61).
 */
export function GroupPrefsCard({
  anyoneCanPost,
  onAnyoneCanPost,
  anyoneCanPostPending,
  whoCanInvite,
  notify,
  onNotify,
  notifyPending,
  isAdmin,
  adminSummary,
  onEditProfile,
  onAdmins,
}: Props) {
  const limits = isAdmin ? [] : memberLimits(whoCanInvite, anyoneCanPost);

  return (
    <View style={settingsStyles.section}>
      <ThemedText variant="sectionLabel">How it runs</ThemedText>
      <Card padded={false}>
        {isAdmin ? (
          <PrefSwitchRow
            label="Anyone can post plans"
            caption="Off means only admins can"
            value={anyoneCanPost}
            disabled={anyoneCanPostPending}
            onChange={onAnyoneCanPost}
            testID="pref-anyone-can-post"
          />
        ) : null}
        <PrefSwitchRow
          label="Notify me on new plans"
          caption="Push as soon as something lands"
          value={notify}
          disabled={notifyPending}
          onChange={onNotify}
          divided={isAdmin}
          testID="pref-notify"
        />
        {isAdmin ? (
          <>
            <Pressable
              style={({ pressed }) => [
                settingsStyles.prefRow,
                settingsStyles.divider,
                pressed && styles.rowPressed,
              ]}
              onPress={onAdmins}
              accessibilityRole="button"
              testID="manage-admins"
            >
              <View style={styles.prefBody}>
                <ThemedText variant="bodyStrong">Admins</ThemedText>
                <ThemedText variant="caption">{adminSummary}</ThemedText>
              </View>
              <ForwardGlyph color={colors.textFaint} testID="admins-forward-glyph" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                settingsStyles.prefRow,
                settingsStyles.divider,
                pressed && styles.rowPressed,
              ]}
              onPress={onEditProfile}
              accessibilityRole="button"
              testID="edit-group"
            >
              <ThemedText variant="bodyStrong">Edit group profile</ThemedText>
              <ForwardGlyph color={colors.textFaint} testID="edit-group-forward-glyph" />
            </Pressable>
          </>
        ) : null}
      </Card>
      {limits.length > 0 ? (
        <View style={styles.limits} testID="member-limits">
          {limits.map((line) => (
            <ThemedText key={line} variant="caption" style={settingsStyles.note}>
              {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  limits: {
    gap: 2,
  },
  prefBody: {
    flex: 1,
    gap: 3,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
});
