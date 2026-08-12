import { keyFactory } from './queryKey';

/**
 * A plan's album, or with no id the prefix covering every plan's.
 *
 * The one key in the sweep that does *not* sit beside its hook, and the
 * reason is import weight rather than taste. `usePlanPhotos` reaches
 * `lib/photos.ts` and through it `lib/images.ts`, which pulls
 * expo-image-picker, expo-image-manipulator and expo-file-system at module
 * scope. `lib/realtime.ts` needs this key and is imported by
 * `app/(app)/_layout.tsx`, so putting the key in the hook would instantiate
 * the native image modules the moment somebody signs in, and would move a
 * failure in any of them out of the album screen and into the layout that
 * renders every authenticated screen.
 */
export const planPhotosKey = keyFactory('plan-photos');
