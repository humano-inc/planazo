import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { type PlaceDraft, pickPlace, removePlace, typeWords } from '../../lib/placeDraft';
import { usePlaceSearch } from '../../lib/usePlaceSearch';
import { Card, CloseGlyph, ThemedText } from '../ui';
import { colors, radii, spacing, type } from '../../theme/tokens';

interface Props {
  draft: PlaceDraft;
  onChange: (draft: PlaceDraft) => void;
  /** Which city to search around. */
  cityId: string | null;
  /** Called with the input when suggestions open, so the form can make room for them. */
  onSuggestionsOpen?: (input: ComponentRef<typeof TextInput> | null) => void;
}

/**
 * Where a plan is happening (PLA-156): free text, with real places to pick from.
 *
 * Picking is optional, because "casa de Juan" is a real answer. Suggestions only
 * appear while someone is typing here, so opening a saved plan spends nothing.
 */
export function PlaceField({ draft, onChange, cityId, onSuggestionsOpen }: Props) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [typing, setTyping] = useState(false);
  const { suggestions } = usePlaceSearch(typing && !draft.placeId ? draft.words : '', cityId);
  const open = suggestions.length > 0;

  useEffect(() => {
    if (open) onSuggestionsOpen?.(inputRef.current);
  }, [open, onSuggestionsOpen]);

  return (
    <View style={styles.field}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Where's it happening?"
        placeholderTextColor={colors.textFaint}
        value={draft.words}
        onChangeText={(words) => {
          setTyping(true);
          onChange(typeWords(draft, words));
        }}
        onBlur={() => setTyping(false)}
        testID="location-input"
      />

      {open ? (
        <Card padded={false} testID="place-suggestions">
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.id}
              accessibilityRole="button"
              accessibilityLabel={`${suggestion.title}, ${suggestion.subtitle}`}
              onPress={() => {
                setTyping(false);
                onChange(pickPlace(draft, suggestion));
              }}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.divider,
                pressed && styles.pressed,
              ]}
              testID={`place-suggestion-${index}`}
            >
              <ThemedText variant="body" numberOfLines={1}>
                {suggestion.title}
              </ThemedText>
              <ThemedText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {suggestion.subtitle}
              </ThemedText>
            </Pressable>
          ))}
          {/* Exactly these words in this style: Google's attribution rules, which
              is why this is neither a ThemedText nor a token. */}
          <Text style={styles.attribution} numberOfLines={1} allowFontScaling={false}>
            Google Maps
          </Text>
        </Card>
      ) : null}

      {draft.placeId ? (
        <View style={styles.picked} testID="place-picked">
          <View style={styles.pickedWords}>
            <ThemedText variant="bodyStrong" numberOfLines={1}>
              {draft.picked?.title ?? 'Exact place saved'}
            </ThemedText>
            {draft.picked?.subtitle ? (
              <ThemedText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {draft.picked.subtitle}
              </ThemedText>
            ) : null}
            <ThemedText variant="caption" color={colors.textMuted}>
              Google Maps opens this place. People see what you wrote above.
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove this place"
            hitSlop={8}
            onPress={() => onChange(removePlace(draft))}
            style={styles.remove}
            testID="place-remove"
          >
            <CloseGlyph color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
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
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  pressed: {
    opacity: 0.6,
  },
  attribution: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontWeight: '400',
    color: '#5E5E5E',
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 5,
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  pickedWords: {
    flex: 1,
    gap: 2,
  },
  remove: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
