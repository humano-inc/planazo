import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { colors } from '../../theme/tokens';
import { glyphFallback, type MaterialName } from './glyphFallback';

interface GlyphSpec {
  sf: SymbolViewProps['name'];
  material: MaterialName;
  /** SF Symbols optically centre their own box, so the two sizes differ. */
  size: number;
  fallbackSize: number;
  color: string;
}

const GLYPHS = {
  back: {
    sf: 'chevron.backward',
    material: 'chevron-left',
    size: 20,
    fallbackSize: 24,
    color: colors.accent,
  },
  forward: {
    sf: 'chevron.forward',
    material: 'chevron-right',
    size: 20,
    fallbackSize: 24,
    color: colors.accent,
  },
  more: {
    sf: 'ellipsis',
    material: 'more-horiz',
    size: 22,
    fallbackSize: 24,
    color: colors.textMuted,
  },
  up: {
    sf: 'chevron.up',
    material: 'keyboard-arrow-up',
    size: 16,
    fallbackSize: 22,
    color: colors.textMuted,
  },
  down: {
    sf: 'chevron.down',
    material: 'keyboard-arrow-down',
    size: 16,
    fallbackSize: 22,
    color: colors.textMuted,
  },
  close: {
    sf: 'xmark',
    material: 'close',
    size: 16,
    fallbackSize: 20,
    color: colors.textMuted,
  },
  plus: {
    sf: 'plus',
    material: 'add',
    size: 18,
    fallbackSize: 22,
    color: colors.textPrimary,
  },
  minus: {
    sf: 'minus',
    material: 'remove',
    size: 18,
    fallbackSize: 22,
    color: colors.textPrimary,
  },
} satisfies Record<string, GlyphSpec>;

type GlyphName = keyof typeof GLYPHS;

interface GlyphProps {
  color?: string;
  /** Use one explicit optical size on both platforms. */
  size?: number;
  style?: SymbolViewProps['style'];
  /**
   * Override when a screen draws the same glyph twice. The default is shared,
   * so two on one screen make `getByTestId` ambiguous.
   */
  testID?: string;
}

/** SF Symbol on iOS, Material icon everywhere SF Symbols are unavailable. */
function Glyph({ name, color, size, style, testID }: GlyphProps & { name: GlyphName }) {
  const spec = GLYPHS[name];
  const tint = color ?? spec.color;

  return (
    <SymbolView
      name={spec.sf}
      fallback={glyphFallback(spec.material, size ?? spec.fallbackSize, tint)}
      size={size ?? spec.size}
      weight="semibold"
      tintColor={tint}
      style={style}
      testID={testID ?? `${name}-glyph`}
    />
  );
}

export function BackGlyph(props: GlyphProps) {
  return <Glyph name="back" {...props} />;
}

export function ForwardGlyph(props: GlyphProps) {
  return <Glyph name="forward" {...props} />;
}

export function MoreGlyph(props: GlyphProps) {
  return <Glyph name="more" {...props} />;
}

export function DisclosureGlyph({
  expanded,
  color,
  testID = 'disclosure-glyph',
}: GlyphProps & { expanded: boolean }) {
  return <Glyph name={expanded ? 'up' : 'down'} color={color} testID={testID} />;
}

export function CloseGlyph(props: GlyphProps) {
  return <Glyph name="close" {...props} />;
}

export function PlusGlyph(props: GlyphProps) {
  return <Glyph name="plus" {...props} />;
}

export function MinusGlyph(props: GlyphProps) {
  return <Glyph name="minus" {...props} />;
}
