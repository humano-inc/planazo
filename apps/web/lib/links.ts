/**
 * Outbound destinations for every CTA on the site.
 *
 * Every "get the app" button points at `GET_APP_URL`, never at a store. A shared
 * link is opened on whatever phone it reaches, so the choice of store belongs to
 * the request, and /get is the one place that reads it.
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6757166218';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.somosplanazo.app';

export const GET_APP_URL = '/get';

export const CONTACT_EMAIL = 'hola@planazo.me';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://planazo.me';

export type Store = 'app-store' | 'google-play';

/**
 * The store a phone can install from, or null when the user agent does not say.
 *
 * Null is the honest answer for a desktop browser, and for an iPad in its default
 * desktop mode, which reports itself as a Mac. Those get the chooser, because a
 * wrong guess there lands on a store page that cannot install anything.
 */
export function storeForUserAgent(userAgent: string | null): Store | null {
  if (!userAgent) return null;
  if (/android/i.test(userAgent)) return 'google-play';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'app-store';
  return null;
}
