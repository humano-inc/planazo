import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { TextAction } from './TextAction';
import { PlusGlyph } from './NavigationGlyphs';
import { tileRadius } from './GroupTile';
import { openActionSheet } from '../../lib/actionSheet';
import { pickFromLibrary, takePhoto } from '../../lib/images';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

const SHEET_TITLE = 'A photo makes the group easier to spot in a list.';
const TILE = 64;

interface GroupPhotoFieldProps {
  /** What to show: a local pick, the saved photo, or null for "no photo yet" */
  uri?: string | null;
  /** True while the photo is on its way to storage */
  uploading?: boolean;
  /** The line under Change / Remove — it says something different per screen */
  caption: string;
  onPick: (uri: string) => void;
  onRemove: () => void;
}

/**
 * PLA-30 "Photo" section, shared by the create sheet and Group profile. Three
 * states, one row: nothing yet, on its way, set. The letter tile is the
 * default, so the empty state is an invitation rather than a gap to fill.
 */
export function GroupPhotoField({
  uri,
  uploading = false,
  caption,
  onPick,
  onRemove,
}: GroupPhotoFieldProps) {
  // "Use the letter instead" only exists once there is a photo to undo, which
  // is why nothing here may hardcode a position: openActionSheet derives every
  // index from this list.
  const openPhotoOptions = () =>
    openActionSheet({
      message: SHEET_TITLE,
      androidTitle: 'Group photo',
      rows: [
        {
          label: 'Take a photo',
          run: async () => {
            const picked = await takePhoto();
            if (picked) onPick(picked);
          },
        },
        {
          label: 'Choose from library',
          run: async () => {
            const picked = await pickFromLibrary({ square: true });
            if (picked) onPick(picked);
          },
        },
        ...(uri ? [{ label: 'Use the letter instead', run: onRemove, destructive: true }] : []),
      ],
    });

  return (
    <View style={styles.section}>
      <ThemedText variant="sectionLabel">Photo</ThemedText>

      {uploading && uri ? (
        <View style={styles.row}>
          <Image source={{ uri }} style={[styles.tile, styles.tileSending]} />
          <View style={styles.sendingBody}>
            <ThemedText variant="caption" color={colors.textMuted}>
              Uploading…
            </ThemedText>
            <ProgressBar />
          </View>
        </View>
      ) : uri ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change the group photo"
            onPress={openPhotoOptions}
          >
            <Image source={{ uri }} style={styles.tile} />
          </Pressable>
          <View style={styles.setBody}>
            <View style={styles.actions}>
              <TextAction
                label="Change"
                onPress={openPhotoOptions}
                testID="change-photo"
              />
              <TextAction
                label="Remove"
                tone="quiet"
                onPress={onRemove}
                testID="remove-photo"
              />
            </View>
            <ThemedText variant="caption" color={colors.textMuted} style={styles.caption}>
              {caption}
            </ThemedText>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={openPhotoOptions}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          testID="add-photo"
        >
          <View style={[styles.tile, styles.tileEmpty]}>
            <PlusGlyph color={colors.textFaint} />
          </View>
          <View style={styles.emptyBody}>
            <ThemedText style={styles.actionLabel} color={colors.accentText}>
              Add a photo
            </ThemedText>
            <ThemedText variant="caption" color={colors.textMuted} style={styles.caption}>
              Optional. Without one the group keeps its letter.
            </ThemedText>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Indeterminate on purpose. supabase-js `upload` resolves or throws with
 * nothing in between, so a percentage would be a number we made up. This says
 * "working" honestly and stops when the upload does.
 */
function ProgressBar() {
  const travel = useRef(new Animated.Value(0)).current;
  const [track, setTrack] = useState(0);

  // Started once, not per layout pass: the interpolation below is rebuilt on
  // every render anyway, so it picks up the measured width without the loop
  // having to stop and restart.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  const segment = Math.max(24, track * 0.4);

  return (
    <View style={styles.progressTrack} onLayout={(e) => setTrack(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: segment,
            transform: [
              {
                translateX: travel.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-segment, track],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: MIN_TOUCH_TARGET,
  },
  rowPressed: {
    opacity: 0.7,
  },
  // Same squircle as the real tile, by reference rather than by a 20 that
  // happens to match today.
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: tileRadius(TILE),
    overflow: 'hidden',
  },
  tileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  tileSending: {
    opacity: 0.5,
  },
  emptyBody: {
    gap: spacing.xxs,
  },
  setBody: {
    gap: spacing.xs,
  },
  sendingBody: {
    flex: 1,
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    lineHeight: 19,
    maxWidth: 200,
  },
  progressTrack: {
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});
