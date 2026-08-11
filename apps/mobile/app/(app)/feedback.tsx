import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { alertActionError } from '../../lib/queryErrors';
import { useAuthStore } from '../../stores/authStore';
import { pickFromLibrary, uploadJpeg } from '../../lib/images';
import { feedbackSheetOpen } from '../../lib/feedbackState';
import { hitSlopTo } from '../../lib/a11y';
import { useDismissTo } from '../../lib/navigation';
import {
  CloseGlyph,
  FormScreen,
  HeaderAction,
  HeaderRow,
  PlusGlyph,
  ThemedText,
  showToast,
} from '../../components/ui';
import { colors, fonts, groupColors, spacing } from '../../theme/tokens';

type Kind = 'broken' | 'idea' | 'other';

const KINDS: { key: Kind; label: string; shape: 'square' | 'circle' | 'diamond'; tint: string }[] = [
  { key: 'broken', label: 'Broken', shape: 'square', tint: groupColors[0] },
  { key: 'idea', label: 'Idea', shape: 'circle', tint: groupColors[1] },
  { key: 'other', label: 'Other', shape: 'diamond', tint: groupColors[2] },
];

/**
 * 14b — one screen, three taps max. Two ways in (user decision 2026-07-29):
 * an OS screenshot arrives with `shot` pre-attached; the profile-sheet row
 * arrives bare, with the library picker as the only way to attach.
 */
export default function FeedbackScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ shot?: string }>();
  const fromScreenshot = !!params.shot;

  const cancel = useDismissTo('/(app)/(tabs)');
  // The profile-row path sits on the profile formSheet, so sending drops both:
  // the toast renders under native sheets and would otherwise be invisible.
  // A screenshot arrives on its own, and a cold deep link on nothing at all,
  // which is the fallback's job.
  const leaveAfterSending = useDismissTo('/(app)/(tabs)', fromScreenshot ? 1 : 2);

  const [kind, setKind] = useState<Kind | null>(null);
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<string | null>(params.shot ?? null);

  useEffect(() => {
    feedbackSheetOpen.current = true;
    return () => {
      feedbackSheetOpen.current = false;
    };
  }, []);

  const valid = !!kind && (!!attachment || message.trim().length > 0);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      let screenshotPath: string | null = null;
      if (attachment) {
        screenshotPath = `${user.id}/${Date.now()}.jpg`;
        await uploadJpeg({ bucket: 'feedback-screenshots', path: screenshotPath, uri: attachment });
      }
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        kind: kind!,
        message: message.trim(),
        screenshot_path: screenshotPath,
        app_version: Constants.expoConfig?.version ?? null,
        device_model: Device.modelName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leaveAfterSending();
      showToast('Got it, thanks. We read every one.');
    },
    onError: alertActionError,
  });

  const addPhoto = async () => {
    const uri = await pickFromLibrary();
    if (uri) setAttachment(uri);
  };

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={cancel} tone="muted" testID="cancel" />}
      right={
        <HeaderAction
          label="Send"
          align="end"
          disabled={!valid || send.isPending}
          onPress={() => send.mutate()}
          testID="send"
        />
      }
      title="Send feedback"
    />
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="feedback">
      <View style={styles.section}>
        <ThemedText variant="sectionLabel">What is it?</ThemedText>
        <View style={styles.kindRow}>
          {KINDS.map((k) => {
            const active = kind === k.key;
            return (
              <Pressable
                key={k.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setKind(k.key)}
                style={[styles.kindTile, active && styles.kindTileActive]}
                testID={`kind-${k.key}`}
              >
                <View
                  style={[
                    styles.shape,
                    k.shape === 'circle' && styles.shapeCircle,
                    k.shape === 'diamond' && styles.shapeDiamond,
                    { backgroundColor: active ? k.tint : colors.borderStrong },
                  ]}
                />
                <ThemedText
                  variant="caption"
                  color={active ? colors.background : colors.textSecondary}
                  style={active ? styles.kindLabelActive : undefined}
                >
                  {k.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.noteWrap}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="What happened, or what should exist?"
          placeholderTextColor={colors.textFaint}
          style={styles.note}
          multiline
          testID="message-input"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.attachedLabel}>
          <ThemedText variant="sectionLabel">Attached</ThemedText>
          <ThemedText variant="caption" color={colors.textFaint}>
            {fromScreenshot ? 'the screen you were on' : 'totally optional'}
          </ThemedText>
        </View>
        <View style={styles.thumbRow}>
          {attachment ? (
            <View style={styles.thumbWrap}>
              <Image source={{ uri: attachment }} style={styles.thumb} testID="attachment" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove attached photo"
                onPress={() => setAttachment(null)}
                style={styles.thumbRemove}
                // The one control in the app that keeps hitSlop: a 20pt
                // badge sitting on the thumbnail it removes, where a real
                // full-size box would cover the image underneath it.
                hitSlop={hitSlopTo(20)}
                testID="remove-attachment"
              >
                <CloseGlyph color={colors.background} />
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={addPhoto}
            style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
            testID="add-photo"
          >
            <PlusGlyph color={colors.textFaint} />
            <ThemedText variant="caption" color={colors.textSecondary}>
              Add photo
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ThemedText variant="caption" color={colors.textFaint} style={styles.privacy}>
        Your name, phone model and app version go with it. Nothing from your plans.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    // flexGrow, so `privacy` can still be pushed to the bottom by its auto
    // margin on a screen too short to scroll. FormScreen owns the horizontal
    // padding and the home-indicator inset.
    flexGrow: 1,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  section: {
    gap: 10,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindTile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  kindTileActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  kindLabelActive: {
    fontFamily: fonts.bodyBold,
  },
  shape: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  shapeCircle: {
    borderRadius: 999,
  },
  shapeDiamond: {
    transform: [{ rotate: '45deg' }],
  },
  noteWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 120,
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
  attachedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 86,
    height: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 86,
    height: 130,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  privacy: {
    marginTop: 'auto',
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.7,
  },
});
