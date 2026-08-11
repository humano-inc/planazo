import { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useDismissTo } from '../../../lib/navigation';
import { contentViolation } from '../../../lib/moderation';
import { useAuthStore } from '../../../stores/authStore';
import { pickFromLibrary, takePhoto, uploadAvatar } from '../../../lib/images';
import {
  Avatar,
  FormScreen,
  HeaderAction,
  HeaderRow,
  TextAction,
  ThemedText,
} from '../../../components/ui';
import { colors, fonts, spacing } from '../../../theme/tokens';

type PhotoDraft = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; uri: string };

const PHOTO_SHEET_TITLE = 'Your photo is what friends see next to your yes';

/**
 * 12c — the edit screen behind the sheet's one Edit button. Save greys out
 * until something actually changed; the photo sheet (11b) keeps "use my
 * initial" as the honest default.
 */
export default function ProfileEdit() {
  const leave = useDismissTo('/(app)/profile');
  const { profile, setProfile } = useAuthStore();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: 'keep' });

  const trimmed = name.trim();
  const nameChanged = trimmed.length > 0 && trimmed !== profile?.display_name;
  const photoChanged =
    photo.kind === 'new' || (photo.kind === 'remove' && !!profile?.avatar_url);
  const dirty = nameChanged || photoChanged;

  const save = useMutation({
    mutationFn: async () => {
      // Guideline 1.2: objectionable language stops here, not in review.
      const violation = nameChanged ? contentViolation({ name: trimmed }) : null;
      if (violation) throw new Error(violation);
      const updates: { display_name?: string; avatar_url?: string | null } = {};
      if (nameChanged) updates.display_name = trimmed;
      if (photo.kind === 'new') {
        updates.avatar_url = await uploadAvatar(profile!.id, photo.uri);
      } else if (photo.kind === 'remove') {
        updates.avatar_url = null;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setProfile(data);
      leave();
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const applyChoice = async (index: number) => {
    if (index === 0) {
      const uri = await takePhoto();
      if (uri) setPhoto({ kind: 'new', uri });
    } else if (index === 1) {
      const uri = await pickFromLibrary({ square: true });
      if (uri) setPhoto({ kind: 'new', uri });
    } else if (index === 2) {
      setPhoto({ kind: 'remove' });
    }
  };

  const openPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: PHOTO_SHEET_TITLE,
          options: ['Take a photo', 'Choose from library', 'Use my initial instead', 'Cancel'],
          cancelButtonIndex: 3,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index !== 3) void applyChoice(index);
        }
      );
    } else {
      Alert.alert('Change photo', PHOTO_SHEET_TITLE, [
        { text: 'Take a photo', onPress: () => void applyChoice(0) },
        { text: 'Choose from library', onPress: () => void applyChoice(1) },
        { text: 'Use my initial instead', onPress: () => void applyChoice(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const shownUri =
    photo.kind === 'new' ? photo.uri : photo.kind === 'keep' ? profile?.avatar_url : null;
  const draftName = trimmed || profile?.display_name || '?';

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={leave} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label="Save"
          align="end"
          disabled={!dirty || save.isPending}
          onPress={() => save.mutate()}
          testID="save"
        />
      }
      title="Your profile"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.body} testID="profile-edit">
      <View style={styles.photoBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={openPhotoOptions}
          style={styles.avatarWrap}
          testID="avatar-press"
        >
          <Avatar name={draftName} dark size={96} imageUrl={shownUri} />
          <View style={styles.badge}>
            <ThemedText variant="caption" color={colors.textOnAccent}>
              ✦
            </ThemedText>
          </View>
        </Pressable>
        <TextAction
          label="Change photo"
          onPress={openPhotoOptions}
          testID="change-photo"
        />
      </View>

      <View style={styles.field}>
        <ThemedText variant="sectionLabel">Your name</ThemedText>
        <View style={styles.inputWrap}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoFocus
            testID="name-input"
          />
        </View>
        <ThemedText variant="caption" style={styles.hint}>
          This is what your groups see next to your yes.
          {profile?.handle ? ` Your handle @${profile.handle} can't change. Invite links point at it.` : ''}
        </ThemedText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    // This screen had no ScrollView at all, so at large text sizes the hint
    // under the name field simply ran off the bottom. flexGrow keeps the
    // spacing it had while letting it scroll when it no longer fits.
    flexGrow: 1,
    paddingTop: 14,
    gap: 26,
  },
  photoBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2.5,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: spacing.sm,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
  },
  input: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    padding: 0,
  },
  hint: {
    lineHeight: 19,
  },
});
