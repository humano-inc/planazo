import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { City } from '@planazo/shared';
import { groupGoneCopy } from '../../../../lib/queryErrors';
import { useDismissTo } from '../../../../lib/navigation';
import { useGroupCity } from '../../../../lib/useGroupCity';
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

/** Changing where a group meets (PLA-88), admin only. */
export default function GroupCityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leave = useDismissTo(`/(app)/group/${id}/manage`);
  // The whole row, not its id: the note needs the name, and looking it back up
  // from the list would be buying back what the picker already handed over.
  const [picked, setPicked] = useState<City | null>(null);

  const { data: group, isLoading, isError, error, refetch, save } = useGroupCity(id);

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

  const changed = !!picked && picked.id !== group.city_id;
  const note = changed ? cityMoveNote(group.city.name, picked.name) : null;

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={leave} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label="Save"
          align="end"
          onPress={() => changed && save.mutate(picked.id, { onSuccess: leave })}
          disabled={!changed || save.isPending}
          testID="save"
        />
      }
      title="City"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="group-city">
      {/* Above the list, not under it as the design draws it. The mock's list
          is two rows deep because a search narrowed it; ours is every city
          until someone types, which puts a note underneath several screens
          below the Save that acts on it. What the note is for is being read
          before you commit, so it sits where Save is. */}
      {note ? (
        <View style={styles.note} testID="city-move-note">
          <ThemedText variant="bodyStrong">{note.title}</ThemedText>
          <ThemedText variant="sub">{note.body}</ThemedText>
        </View>
      ) : null}

      <CityPicker selectedId={picked?.id ?? group.city_id} onSelect={setPicked} />
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
