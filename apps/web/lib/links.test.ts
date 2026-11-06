import { describe, expect, it } from 'vitest';

import { storeForUserAgent } from './links';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const WHATSAPP_ANDROID = `${ANDROID} WhatsApp/2.24.1`;
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_LEGACY =
  'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('storeForUserAgent', () => {
  it('sends an Android phone to Google Play', () => {
    expect(storeForUserAgent(ANDROID)).toBe('google-play');
  });

  // Invites travel through group chats, so an in-app browser is the usual case.
  it('recognises Android inside an in-app browser', () => {
    expect(storeForUserAgent(WHATSAPP_ANDROID)).toBe('google-play');
  });

  it('sends an iPhone to the App Store', () => {
    expect(storeForUserAgent(IPHONE)).toBe('app-store');
  });

  it('sends an iPad that admits to being one to the App Store', () => {
    expect(storeForUserAgent(IPAD_LEGACY)).toBe('app-store');
  });

  it('does not guess for a desktop browser', () => {
    expect(storeForUserAgent(MAC)).toBeNull();
  });

  it('does not guess when there is no user agent', () => {
    expect(storeForUserAgent(null)).toBeNull();
    expect(storeForUserAgent('')).toBeNull();
  });
});
