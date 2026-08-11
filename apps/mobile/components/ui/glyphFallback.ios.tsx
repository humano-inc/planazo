import type { ReactNode } from 'react';

/**
 * iOS always has the SF Symbol, so `SymbolView` never renders a fallback here.
 * Returning null keeps `@expo/vector-icons` out of the iOS bundle, worth 61KB.
 * See `glyphFallback.tsx` for the platform that actually needs one.
 */
export function glyphFallback(): ReactNode {
  return null;
}
