import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { alertActionError, UserFacingError } from '../../../../lib/queryErrors';
import { useDismissTo } from '../../../../lib/navigation';
import { planDetailKey, planDetailQuery } from '../../../../lib/usePlanDetail';
import { feedKey } from '../../../../lib/useFeed';
import { contentViolation } from '../../../../lib/moderation';
import { FormScreen, HeaderAction, HeaderRow, ThemedText } from '../../../../components/ui';
import { colors, fonts, radii, spacing, type } from '../../../../theme/tokens';

/**
 * PLA-31 — the host menu's "Edit the details".
 *
 * Three fields and no more: a typo and a moved venue are the two reasons a
 * live plan needs touching, and neither of them should cost the RSVPs. What
 * is *not* here is the point — the group, the dates, the minimum and the cap
 * all decide what a yes already meant, so changing them under people who
 * answered would quietly turn their answer into one they never gave. Those
 * still need calling it off and starting again.
 *
 * The database agrees rather than trusting this screen: after 20260802000002
 * `authenticated` holds UPDATE on exactly title, location and description.
 */
export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const leave = useDismissTo(`/(app)/plan/${id}`);

  // null means "untouched, show what's stored" — so a field the host never
  // visits can't overwrite a value that changed under them.
  const [title, setTitle] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  // Warm from the detail screen's cache: one shared descriptor, because same
  // key means the select has to match its shape exactly and a slimmer one here
  // would clobber the joins the detail screen renders from (creator,
  // canceller, groups).
  const { data: plan } = useQuery(planDetailQuery(id));

  const draftTitle = title ?? plan?.title ?? '';
  const draftPlace = place ?? plan?.location ?? '';
  const draftNotes = notes ?? plan?.description ?? '';

  // Place and notes are nullable columns but always strings up here, so both
  // sides of the comparison are normalised before it means anything.
  const dirty =
    !!plan &&
    (draftTitle.trim() !== plan.title ||
      draftPlace.trim() !== (plan.location ?? '') ||
      draftNotes.trim() !== (plan.description ?? ''));
  const valid = draftTitle.trim().length > 0;

  const save = useMutation({
    mutationFn: async () => {
      // Guideline 1.2: objectionable language stops here, not in review. Same
      // field names as the create sheet, so the sentence reads the same
      // wherever the word was typed.
      const violation = contentViolation({
        'plan title': draftTitle,
        'plan description': draftNotes,
        location: draftPlace,
      });
      if (violation) throw new UserFacingError(violation);

      const { data, error } = await supabase
        .from('plans')
        .update({
          title: draftTitle.trim(),
          location: draftPlace.trim() || null,
          description: draftNotes.trim() || null,
        })
        .eq('id', id)
        .select('id');
      if (error) throw error;

      // An UPDATE the policy filtered out is not an error: PostgREST answers
      // 200 with no rows, so `error` is null and this screen would close on a
      // write that never happened. That silence is what made "Change" a dead
      // button on every answered plan (PLA-16). Asking for the row back is
      // what turns "you're not the host any more" into something visible.
      if (data.length === 0) {
        throw new UserFacingError(
          "That didn't save. You're not the host of this plan any more, or it was called off while you had this open."
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planDetailKey(id) });
      queryClient.invalidateQueries({ queryKey: feedKey() });
      if (plan?.group_id) {
        queryClient.invalidateQueries({ queryKey: ['group-plans', plan.group_id] });
      }
      leave();
    },
    onError: alertActionError,
  });

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={leave} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label="Save"
          align="end"
          onPress={() => save.mutate()}
          disabled={!dirty || !valid || save.isPending}
          testID="save"
        />
      }
      title="Edit plan"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="plan-edit">
      <View style={styles.titleBlock}>
        <TextInput
          style={styles.titleInput}
          placeholder="Padel? Paella? Poker?"
          placeholderTextColor={colors.textFaint}
          value={draftTitle}
          onChangeText={setTitle}
          testID="title-input"
        />
        <View style={styles.rule} />
      </View>

      <View style={styles.section}>
        <ThemedText variant="sectionLabel">Where</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Where's it happening?"
          placeholderTextColor={colors.textFaint}
          value={draftPlace}
          onChangeText={setPlace}
          testID="location-input"
        />
      </View>

      <View style={styles.section}>
        <ThemedText variant="sectionLabel">Anything they should know</ThemedText>
        <TextInput
          style={[styles.input, styles.notes]}
          placeholder="Bring cash, wear trainers…"
          placeholderTextColor={colors.textFaint}
          value={draftNotes}
          onChangeText={setNotes}
          multiline
          testID="notes-input"
        />
      </View>

      {/* Said out loud rather than left to be discovered: an edit is
          silent. Whoever is already in finds out by opening the plan. */}
      <ThemedText variant="caption" color={colors.textMuted} style={styles.hint}>
        Nobody gets a notification. They'll see the change next time they open the plan. The
        date, the group and the numbers stay as they are.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
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
  input: {
    ...type.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    padding: 15,
  },
  notes: {
    height: 88,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: fonts.body,
    lineHeight: 19,
  },
});
