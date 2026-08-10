import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDismissTo } from '../../../../lib/navigation';
import { submitPollDraft, planPollKey } from '../../../../lib/usePlanPoll';
import { emptyPollDraft, pollDraftValid } from '../../../../lib/pollDraft';
import { PollOptionsEditor } from '../../../../components/PollComposer';
import { ThemedText, Button, FormScreen } from '../../../../components/ui';
import { colors, fonts, spacing, type } from '../../../../theme/tokens';

/**
 * PLA-47 — "+ Add a poll" from the plan body, host only.
 *
 * The question is the title, written the way the plan's own title is
 * written. Below it, the options with a way back out of each, and a card
 * saying exactly how the vote will run: the people who are in, one pick
 * each, a tally that just runs. A poll added to a live plan announces
 * itself; one born with its plan (the create sheet's collapsed section)
 * rides the plan_created push instead.
 */
export default function NewPollScreen() {
  // peopleIn rides in from the add-a-poll card, the sheet's only entry
  // point: the plan screen already holds the number, so fetching it again
  // here would be a round-trip for one word of copy.
  const { id, peopleIn: peopleInParam } = useLocalSearchParams<{
    id: string;
    peopleIn?: string;
  }>();
  const peopleIn = Number(peopleInParam) || 0;
  const queryClient = useQueryClient();
  const leave = useDismissTo(`/(app)/plan/${id}`);
  const [draft, setDraft] = useState(emptyPollDraft());

  const add = useMutation({
    mutationFn: () => submitPollDraft(String(id), draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planPollKey(String(id)) });
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      leave();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const valid = pollDraftValid(draft);
  const onTable = draft.options.filter((o) => o.trim().length > 0).length;

  const header = (
    <View style={styles.header}>
      <Pressable onPress={leave} accessibilityRole="button" testID="cancel">
        <ThemedText variant="bodyStrong" color={colors.textMuted}>
          Cancel
        </ThemedText>
      </Pressable>
      <ThemedText style={styles.headerTitle}>New poll</ThemedText>
      <View style={styles.headerSpacer} />
    </View>
  );

  return (
    <FormScreen
      header={header}
      contentContainerStyle={styles.content}
      testID="poll"
      footer={
        <Button
          label={add.isPending ? 'Adding…' : 'Add the poll'}
          variant={valid ? 'primary' : 'secondary'}
          disabled={!valid || add.isPending}
          haptic={valid}
          onPress={() => add.mutate()}
          testID="ask"
        />
      }
    >
      <View style={styles.titleBlock}>
        <TextInput
          style={styles.titleInput}
          placeholder="What's your question?"
          placeholderTextColor={colors.textFaint}
          value={draft.question}
          onChangeText={(question) => setDraft((d) => ({ ...d, question }))}
          autoFocus
          testID="poll-question-input"
        />
        <View style={styles.rule} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <ThemedText variant="sectionLabel">The options</ThemedText>
          {onTable > 0 ? (
            <ThemedText variant="caption" color={colors.accent}>
              {onTable} on the table
            </ThemedText>
          ) : null}
        </View>
        <PollOptionsEditor
          options={draft.options}
          onChange={(options) => setDraft((d) => ({ ...d, options }))}
        />
      </View>

      <View style={styles.section}>
        <ThemedText variant="sectionLabel">How it works</ThemedText>
        <View style={styles.howCard}>
          <View style={styles.howRow}>
            <ThemedText variant="body">Who votes</ThemedText>
            <ThemedText variant="bodyStrong">
              {peopleIn ? `The ${peopleIn} who are in` : 'The people who are in'}
            </ThemedText>
          </View>
          <View style={styles.howDivider} />
          <View style={styles.howRow}>
            <ThemedText variant="body">Each person picks</ThemedText>
            <ThemedText variant="bodyStrong">One</ThemedText>
          </View>
        </View>
        <ThemedText variant="caption" color={colors.textMuted} style={styles.hint}>
          Names show against every option, and nobody's stuck with their pick. The tally just
          runs. You decide when it's decided.
        </ThemedText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    // fonts.display is already the 700 weight; the fontWeight that used to sit
    // here restated it.
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 48,
  },
  content: {
    paddingTop: spacing.sm,
    gap: 22,
  },
  titleBlock: {
    gap: 10,
  },
  titleInput: {
    ...type.screenTitle,
    padding: 0,
  },
  rule: {
    height: 2,
    backgroundColor: colors.borderStrong,
  },
  section: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  howCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    overflow: 'hidden',
  },
  howRow: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  howDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  hint: {
    lineHeight: 19,
  },
});
