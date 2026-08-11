import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';

export type MaterialName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * What a glyph draws where SF Symbols do not exist.
 *
 * This module is platform-split: `glyphFallback.ios.tsx` returns null and
 * imports nothing, so Metro keeps `@expo/vector-icons` out of the iOS graph
 * entirely. `SymbolView` renders its `fallback` only when there is no native
 * view, which on iOS is never, so the whole icon set would ship to be thrown
 * away: a 2,200-entry glyphmap built at module eval on every cold start.
 * Measured with `expo export --platform ios`, the split takes 61KB off the
 * bundle (6,623,912 to 6,561,609 bytes).
 */
export function glyphFallback(name: MaterialName, size: number, color: string): ReactNode {
  return <MaterialIcons name={name} color={color} size={size} />;
}
