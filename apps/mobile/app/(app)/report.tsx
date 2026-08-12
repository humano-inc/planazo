import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  BLOCKED_QUERY_KEY,
  REPORT_REASONS,
  ReportReason,
  ReportSubject,
  submitReport,
} from '../../lib/moderation';
import { useDismissTo } from '../../lib/navigation';
import { actionErrorCopy } from '../../lib/queryErrors';
import { reportTargets, reportValid } from '../../lib/reportTargets';
import { groupDetailKey, groupManageKey } from '../../lib/groupManageQuery';
import { feedKey } from '../../lib/useFeed';
import { useAuthStore } from '../../stores/authStore';
import {
  Card,
  FormScreen,
  HeaderAction,
  HeaderRow,
  ThemedText,
  showToast,
} from '../../components/ui';
import { colors, fonts, spacing } from '../../theme/tokens';

const SUBJECT_NOUN: Record<ReportSubject, string> = {
  plan: 'plan',
  group: 'group',
  profile: 'person',
  photo: 'photo',
};

/**
 * Report a plan, a group, or a person — App Store Guideline 1.2.
 *
 * One screen, because a report filed under duress should take seconds. Pick a
 * reason, optionally say more, optionally stop seeing them at the same time.
 * The block toggle is right here on purpose: the two things people want in
 * this moment are "tell someone" and "make it go away", and making them hunt
 * for the second one in a settings screen is how apps end up with neither.
 */
export default function ReportScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{
    type?: ReportSubject;
    id?: string;
    subject?: string;
    personId?: string;
    personName?: string;
  }>();

  // Dismiss target and the self-block guard both live in lib/reportTargets.ts.
  const { subjectType, subjectId, dismissTo, personId, personName } = reportTargets(
    params,
    user?.id
  );
  const leave = useDismissTo(dismissTo);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);

  const valid = reportValid({ subjectId }, reason, user?.id);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !reason || !subjectId) throw new Error('Nothing to report');

      // One RPC, one transaction. Report-then-block as two calls had an ugly
      // failure mode: the report landed, the block didn't, the alert said
      // nothing worked — and the natural retry filed the report twice.
      await submitReport({
        subjectType,
        subjectId,
        reason,
        note,
        blockUserId: alsoBlock && personId ? personId : null,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (alsoBlock && personId) {
        // Their plans vanish from every list the moment the policy re-runs.
        queryClient.invalidateQueries({ queryKey: BLOCKED_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: feedKey() });
        queryClient.invalidateQueries({ queryKey: groupDetailKey() });
        queryClient.invalidateQueries({ queryKey: groupManageKey() });
      }
      leave();
      showToast(
        alsoBlock && personId
          ? `Reported, and you won't see ${personName}'s plans again.`
          : 'Reported. A person reads every one of these.',
      );
    },
    // Keeps its own title, which names the action better than the classified
    // one would, and takes the classified body so a raw postgres message never
    // reaches the reporter.
    onError: (error: unknown) => Alert.alert("Couldn't send that", actionErrorCopy(error).body),
  });

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={leave} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label={send.isPending ? 'Sending…' : 'Send'}
          align="end"
          disabled={!valid || send.isPending}
          onPress={() => send.mutate()}
          testID="send-report"
        />
      }
      title={`Report ${SUBJECT_NOUN[subjectType]}`}
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="report">
      {params.subject ? (
        <ThemedText variant="body" color={colors.textSecondary}>
          You’re reporting{' '}
          <ThemedText variant="bodyStrong">{params.subject}</ThemedText>.
        </ThemedText>
      ) : null}

      <View style={styles.section}>
        <ThemedText variant="sectionLabel">What’s wrong with it?</ThemedText>
        <Card padded={false}>
          {REPORT_REASONS.map((r, index) => {
            const active = reason === r.key;
            return (
              <Pressable
                key={r.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setReason(r.key)}
                style={({ pressed }) => [
                  styles.reasonRow,
                  index > 0 && styles.reasonDivider,
                  pressed && styles.pressed,
                ]}
                testID={`reason-${r.key}`}
              >
                <View style={styles.reasonBody}>
                  <ThemedText variant="bodyStrong">{r.label}</ThemedText>
                  <ThemedText variant="caption">{r.blurb}</ThemedText>
                </View>
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <View style={styles.noteWrap}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything else we should know? (optional)"
          placeholderTextColor={colors.textFaint}
          style={styles.note}
          accessibilityLabel="More about this report"
          multiline
          testID="report-note"
        />
      </View>

      {personId ? (
        <Card padded={false}>
          <View style={styles.blockRow}>
            <View style={styles.reasonBody}>
              <ThemedText variant="bodyStrong">Block {personName}</ThemedText>
              <ThemedText variant="caption">
                You stop seeing their plans. They aren’t told, and they stay in the group
                until an admin says otherwise.
              </ThemedText>
            </View>
            <Switch
              value={alsoBlock}
              onValueChange={setAlsoBlock}
              trackColor={{ false: colors.borderStrong, true: colors.accent }}
              ios_backgroundColor={colors.borderStrong}
              testID="also-block"
            />
          </View>
        </Card>
      ) : null}

      <ThemedText variant="caption" color={colors.textFaint} style={styles.privacy}>
        Reports go to us, not to the group. Whoever you’re reporting is never told who
        reported them.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    // flexGrow, so `privacy` keeps its auto margin on a screen too short to
    // scroll. FormScreen owns the horizontal padding and the bottom inset.
    flexGrow: 1,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  section: {
    gap: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  reasonDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reasonBody: {
    flex: 1,
    gap: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  noteWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 110,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textPrimary,
    padding: 0,
    flex: 1,
    textAlignVertical: 'top',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  privacy: {
    marginTop: 'auto',
    lineHeight: 17,
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
});
