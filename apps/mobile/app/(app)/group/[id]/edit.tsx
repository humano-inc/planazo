import { useState } from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { useDismissTo } from '../../../../lib/navigation';
import { contentViolation } from '../../../../lib/moderation';
import { removeGroupPhoto, uploadGroupPhoto } from '../../../../lib/images';
import { captureError } from '../../../../lib/sentry';
import {
  ThemedText,
  FormScreen,
  GroupTile,
  GroupColourField,
  GroupPhotoField,
  HeaderAction,
  HeaderRow,
  colorForName,
} from '../../../../components/ui';
import { colors, fonts, spacing } from '../../../../theme/tokens';

type PhotoDraft = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; uri: string };

/** 6e "Group profile" — the photo, the name and the colour, nothing else. */
export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const leave = useDismissTo(`/(app)/group/${id}`);
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: 'keep' });

  const { data: group } = useQuery({
    queryKey: ['group-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, color, image_url')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const draftName = name ?? group?.name ?? '';
  // The colour this group already has everywhere else. `color` is null for any
  // group that never picked one, and every other surface derives it from the
  // name instead — GroupTile, and color_for_name() in the database
  // (20260729000000). Falling back to a fixed swatch here would repaint the
  // group on the next save of anything at all, and once a photo hides the
  // swatches nobody would see it happen. Derived from the *saved* name, so
  // renaming does not shuffle the colour under you while you type.
  const savedColor = group?.color ?? colorForName(group?.name ?? '');
  const draftColor = color ?? savedColor;
  const draftImage =
    photo.kind === 'new' ? photo.uri : photo.kind === 'remove' ? null : group?.image_url ?? null;
  const photoChanged =
    photo.kind === 'new' || (photo.kind === 'remove' && !!group?.image_url);
  const dirty =
    !!group && (draftName.trim() !== group.name || draftColor !== savedColor || photoChanged);
  const valid = draftName.trim().length > 0;

  const save = useMutation({
    mutationFn: async () => {
      // Guideline 1.2: objectionable language stops here, not in review.
      const violation = contentViolation({ 'group name': draftName });
      if (violation) throw new Error(violation);
      const updates: { name: string; color: string; image_url?: string | null } = {
        name: draftName.trim(),
        color: draftColor,
      };
      if (photo.kind === 'new') {
        updates.image_url = await uploadGroupPhoto(id, photo.uri);
      } else if (photo.kind === 'remove') {
        updates.image_url = null;
      }
      const { error } = await supabase.from('groups').update(updates).eq('id', id);
      if (error) throw error;

      // Only once the row has stopped pointing at it. An orphaned object is
      // untidy; a row pointing at a deleted one is a broken tile.
      if (photo.kind === 'remove') {
        try {
          await removeGroupPhoto(id);
        } catch (e) {
          captureError(e, 'group photo delete');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      queryClient.invalidateQueries({ queryKey: ['group-manage', id] });
      queryClient.invalidateQueries({ queryKey: ['group-edit', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['home-plans'] });
      leave();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
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
      title="Group profile"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="group-edit">
      <View style={styles.nameRow}>
        <GroupTile
          name={valid ? draftName : '?'}
          color={draftColor}
          imageUrl={draftImage}
          size={52}
        />
        <View style={styles.nameBlock}>
          <TextInput
            style={styles.nameInput}
            placeholder="Name the group"
            placeholderTextColor={colors.textFaint}
            value={draftName}
            onChangeText={setName}
            testID="name-input"
          />
          <View style={styles.rule} />
        </View>
      </View>

      <GroupPhotoField
        uri={draftImage}
        uploading={save.isPending && photo.kind === 'new'}
        caption="Remove it and the letter comes back, on the colour you had."
        onPick={(uri) => setPhoto({ kind: 'new', uri })}
        onRemove={() => setPhoto({ kind: 'remove' })}
      />

      {draftImage ? (
        // The colour is still stored, and still what the feed's card stripe
        // and the group dots use. It just has nothing to do on a tile the
        // photo has taken over, so picking one here would be a lie.
        <ThemedText variant="sub">
          Colour is hidden while a photo is set. It comes back the moment the photo goes.
        </ThemedText>
      ) : (
        <GroupColourField value={draftColor} onChange={setColor} />
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    gap: spacing.xxl,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nameBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  nameInput: {
    fontFamily: fonts.displayHeavy,
    fontSize: 26,
    letterSpacing: -0.52,
    color: colors.textPrimary,
    padding: 0,
  },
  rule: {
    height: 2,
    backgroundColor: colors.borderStrong,
  },
});
