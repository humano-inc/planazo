import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import { colors } from '../../theme/tokens';

interface GlyphProps {
  color?: string;
}

/** SF Symbol on iOS, Material icon everywhere SF Symbols are unavailable. */
export function BackGlyph({ color = colors.accent }: GlyphProps) {
  return (
    <SymbolView
      name="chevron.backward"
      fallback={
        <MaterialIcons name="chevron-left" color={color} size={24} testID="back-glyph-fallback" />
      }
      size={20}
      weight="semibold"
      tintColor={color}
      testID="back-glyph"
    />
  );
}

/** SF Symbol on iOS, Material icon everywhere SF Symbols are unavailable. */
export function ForwardGlyph({ color = colors.accent }: GlyphProps) {
  return (
    <SymbolView
      name="chevron.forward"
      fallback={<MaterialIcons name="chevron-right" color={color} size={24} />}
      size={20}
      weight="semibold"
      tintColor={color}
      testID="forward-glyph"
    />
  );
}

/** SF Symbol on iOS, Material icon everywhere SF Symbols are unavailable. */
export function MoreGlyph({ color = colors.textMuted }: GlyphProps) {
  return (
    <SymbolView
      name="ellipsis"
      fallback={<MaterialIcons name="more-horiz" color={color} size={24} />}
      size={22}
      weight="semibold"
      tintColor={color}
      testID="more-glyph"
    />
  );
}

export function DisclosureGlyph({
  expanded,
  color = colors.textMuted,
}: GlyphProps & { expanded: boolean }) {
  return (
    <SymbolView
      name={expanded ? 'chevron.up' : 'chevron.down'}
      fallback={
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          color={color}
          size={22}
        />
      }
      size={16}
      weight="semibold"
      tintColor={color}
      testID="disclosure-glyph"
    />
  );
}

export function CloseGlyph({ color = colors.textMuted }: GlyphProps) {
  return (
    <SymbolView
      name="xmark"
      fallback={<MaterialIcons name="close" color={color} size={20} />}
      size={16}
      weight="semibold"
      tintColor={color}
      testID="close-glyph"
    />
  );
}

export function PlusGlyph({ color = colors.textPrimary }: GlyphProps) {
  return (
    <SymbolView
      name="plus"
      fallback={<MaterialIcons name="add" color={color} size={22} />}
      size={18}
      weight="semibold"
      tintColor={color}
      testID="plus-glyph"
    />
  );
}

export function MinusGlyph({ color = colors.textPrimary }: GlyphProps) {
  return (
    <SymbolView
      name="minus"
      fallback={<MaterialIcons name="remove" color={color} size={22} />}
      size={18}
      weight="semibold"
      tintColor={color}
      testID="minus-glyph"
    />
  );
}
