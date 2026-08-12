// Same host as the links people share, and it has to be: shareLinks.ts owns
// the constant and says why it must match `applinks:` in app.json.
import { SITE_URL } from './shareLinks';

/**
 * Outbound destinations the app links to.
 *
 * These mirror the pages in `apps/web` — keep them in step, and never point at
 * a URL that is not deployed. App Review Guideline 5.1.1(i) wants the privacy
 * policy reachable *from inside the app*, not only from the store listing, so
 * `PRIVACY_URL` has to resolve before submission.
 */
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const TERMS_URL = `${SITE_URL}/terms`;
export const SUPPORT_URL = `${SITE_URL}/support`;
