import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { alertActionError, groupGoneCopy } from '../../../../lib/queryErrors';
import { useDismissTo } from '../../../../lib/navigation';
import { groupManageQuery, invalidateGroup } from '../../../../lib/groupManageQuery';
import { useCities } from '../../../../lib/useCities';
import { cityMoveNote } from '../../../../lib/cities';
import { CityPicker } from '../../../../components/group/CityPicker';
import {
  ThemedText,
  FormScreen,
  HeaderAction,
  HeaderRow,
  QueryScreen,
} from '../../../../components/ui';
import { colors, spacing } from '../../../../theme/tokens';

/**
 * Changing where a group meets (PLA-88), admin only.
 *
 * The group read is `groupManageQuery`, the same one Manage is already holding
 * when you arrive: one cache entry rather than a second select of the same row
 * that could disagree with it. The write is a plain update, because the RLS
 * policy on `groups` is already `is_group_admin(id)` and the foreign key is
 * already the value check. An RPC here would only re-state both in plpgsql.
 */
export default function GroupCityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const leave = useDismissTo(`/(app)/group/${id}/manage`);
  const [picked, setPicked] = useState<string | null>(null);

  const { data: group, isLoading, isError, error, refetch } = useQuery(groupManageQuery(id));
  const cities = useCities();

  const selectedId = picked ?? group?.city_id ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('the city sheet needs a city to save');
      const { error: saveError } = await supabase
        .from('groups')
        .update({ city_id: selectedId })
        .eq('id', id);
      if (saveError) throw saveError;
    },
    onSuccess: () => {
      invalidateGroup(queryClient, id);
      leave();
    },
    onError: alertActionError,
  });

  // One spelling of "there is nothing to draw", so the guard and what
  // QueryScreen renders behind it can never disagree.
  const failed = isError || !group;
  if (isLoading || failed) {
    return (
      <QueryScreen
        isLoading={isLoading}
        failed={failed}
        id={id}
        error={error}
        goneCopy={groupGoneCopy}
        onRetry={() => refetch()}
        onBack={leave}
        testID="group-city-error"
      />
    );
  }

  // Below the guard, so `group` is a row rather than a maybe: every city here
  // is non-null because the column is.
  const changed = selectedId !== group.city_id;
  const target = (cities.data ?? []).find((c) => c.id === selectedId);
  const note = changed && target ? cityMoveNote(group.city.name, target.name) : null;

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={leave} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label="Save"
          align="end"
          onPress={() => save.mutate()}
          disabled={!changed || save.isPending}
          testID="save"
        />
      }
      title="City"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="group-city">
      <CityPicker
        cities={cities.data ?? []}
        selectedId={selectedId}
        onSelect={(city) => setPicked(city.id)}
      />

      {note ? (
        <View style={styles.note} testID="city-move-note">
          <ThemedText variant="bodyStrong">{note.title}</ThemedText>
          <ThemedText variant="sub">{note.body}</ThemedText>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  note: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 22,
    paddingVertical: spacing.md,
    paddingHorizontal: 18,
    gap: spacing.xxs,
  },
});
