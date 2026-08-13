import { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { City } from '@planazo/shared';
import { supabase } from '../../../lib/supabase';
import { alertActionError, UserFacingError } from '../../../lib/queryErrors';
import { useDismissTo, useLeaveFor } from '../../../lib/navigation';
import { contentViolation } from '../../../lib/moderation';
import { groupsKey } from '../../../lib/useGroupRows';
import { useCities } from '../../../lib/useCities';
import { uploadGroupPhoto } from '../../../lib/images';
import { captureError } from '../../../lib/sentry';
import { FriendPicker } from '../../../components/group/FriendPicker';
import { CityField } from '../../../components/group/CityField';
import { GroupNameRow } from '../../../components/group/GroupNameRow';
import {
  ThemedText,
  Button,
  FormScreen,
  GroupColourField,
  GroupPhotoField,
  HeaderAction,
  HeaderRow,
  showToast,
} from '../../../components/ui';
import { colors, groupColors, spacing, type } from '../../../theme/tokens';

export default function NewGroupScreen() {
  const leaveFor = useLeaveFor();
  const cancel = useDismissTo('/(app)/(tabs)');
  const queryClient = useQueryClient();

  // Params preseed the sheet for deep-link QA (same pattern as plan/create):
  // planazo://group/new?name=Padel&desc=Monday%20nights&color=2&y=0
  const params = useLocalSearchParams<{
    name?: string;
    desc?: string;
    color?: string;
    y?: string;
  }>();

  const [name, setName] = useState(params.name ?? '');
  const [desc, setDesc] = useState(params.desc ?? '');
  const [color, setColor] = useState<string>(
    () => groupColors[Math.min(groupColors.length - 1, Math.max(0, Number(params.color) || 0))]!
  );
  const [picks, setPicks] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [city, setCity] = useState<City | null>(null);

  const cities = useCities();

  const togglePick = (id: string) =>
    setPicks((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const createGroup = useMutation({
    mutationFn: async () => {
      // Guideline 1.2: objectionable language stops here, not in review.
      const violation = contentViolation({
        'group name': name,
        'group description': desc,
      });
      if (violation) throw new UserFacingError(violation);
      // The CTA is disabled until a city is picked, so this only fires if the
      // gate below and this call ever disagree.
      if (!city) throw new UserFacingError('Pick the city you meet in first.');
      // PLA-35: the group row and the creator's admin membership are one
      // server-side write. The client can no longer insert either, and a
      // half-created group was an orphan nobody could see or delete.
      // `undefined` rather than `null`: the argument is dropped from the JSON
      // body and create_group's own `DEFAULT NULL` supplies it, which is the
      // value an explicit null was sending anyway.
      const { data: group, error: groupError } = await supabase.rpc('create_group', {
        p_name: name.trim(),
        p_city_id: city.id,
        p_description: desc.trim() || undefined,
        p_color: color,
      });
      if (groupError) throw groupError;

      // PLA-30: the storage policy keys on being an admin of the group, and
      // that membership only exists once create_group has returned, so the
      // photo cannot go up any earlier than this.
      if (photoUri) {
        try {
          const imageUrl = await uploadGroupPhoto(group.id, photoUri);
          const { error: photoError } = await supabase
            .from('groups')
            .update({ image_url: imageUrl })
            .eq('id', group.id);
          if (photoError) throw photoError;
        } catch (e) {
          // The group exists by now. Failing the whole create would read as
          // "nothing happened" while leaving one behind, so the group wins and
          // the photo is something they can add again.
          captureError(e, 'group photo upload');
          showToast("Group created, but the photo didn't upload. Try again from Group profile.");
        }
      }

      await Promise.all(
        picks.map((invitee) =>
          supabase.rpc('invite_to_group', { p_group_id: group.id, p_invitee: invitee })
        )
      );
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: groupsKey() });
      leaveFor(`/(app)/group/${group.id}`);
    },
    onError: alertActionError,
  });

  const named = name.trim().length > 0;
  // Both are required, and the label says which one is still missing rather
  // than a single "fill this in": the city step is closed by default, so a
  // generic refusal would point at nothing.
  const ready = named && !!city;
  const ctaLabel = !named
    ? 'Name it first'
    : !city
      ? 'Pick a city first'
      : createGroup.isPending
        ? 'Creating…'
        : picks.length > 0
          ? `Create and invite ${picks.length}`
          : 'Create group';

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={cancel} tone="muted" testID="cancel" />}
      rightSpacerWidth={48}
      title="New group"
    />
  );

  return (
    <FormScreen
      header={header}
      contentContainerStyle={styles.content}
      contentOffset={params.y ? { x: 0, y: Number(params.y) } : undefined}
      testID="group-new"
      footer={
        <Button
          label={ctaLabel}
          variant={ready ? 'primary' : 'secondary'}
          disabled={!ready || createGroup.isPending}
          haptic={ready}
          onPress={() => createGroup.mutate()}
          testID="create-cta"
        />
      }
    >
      <GroupNameRow name={name} color={color} imageUrl={photoUri} onChangeName={setName} />

      <CityField
        cities={cities.data ?? []}
        loading={cities.isPending}
        failed={cities.isError}
        value={city}
        onChange={setCity}
      />

      <GroupPhotoField
        uri={photoUri}
        uploading={createGroup.isPending && !!photoUri}
        caption="The photo is the group's tile everywhere."
        onPick={setPhotoUri}
        onRemove={() => setPhotoUri(null)}
      />

      {photoUri ? (
        // Group profile says the same thing when a photo hides the
        // swatches. Saying nothing here made them look like a glitch.
        <ThemedText variant="sub">
          Colour is hidden while a photo is set. It comes back the moment the photo goes.
        </ThemedText>
      ) : (
        <GroupColourField value={color} onChange={setColor} />
      )}

      <View style={styles.section}>
        <ThemedText variant="sectionLabel">What's it for</ThemedText>
        <TextInput
          style={styles.descInput}
          placeholder="One line so people know what they're joining. Skippable."
          placeholderTextColor={colors.textFaint}
          value={desc}
          onChangeText={setDesc}
          multiline
          testID="desc-input"
        />
      </View>

      <FriendPicker picks={picks} onToggle={togglePick} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    gap: spacing.xxl,
  },
  section: {
    gap: 10,
  },
  descInput: {
    ...type.body,
    height: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    padding: 15,
  },
});
