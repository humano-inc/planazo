/**
 * The file Android fetches to decide that planazo.me links belong to the app.
 * The AASA route beside this one is the same promise made to iOS.
 *
 * Both fingerprints are load-bearing, and leaving one out fails silently: links
 * simply open in the browser, with nothing logged anywhere.
 *
 * - **The app signing key** is Google's, and signs every install from Play. It
 *   comes from Play Console, under Protected with Play, App signing.
 * - **The upload key** is EAS's, and signs APKs from the preview profile, which
 *   never pass through Play.
 *
 * The paths are claimed by `android.intentFilters` in `apps/mobile/app.json`, and
 * they have to name this same host.
 */
const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.somosplanazo.app',
      sha256_cert_fingerprints: [
        'B7:CC:4C:6F:37:CA:B0:7B:44:26:0E:67:54:12:02:85:A7:5B:51:6C:E2:52:26:48:CB:0E:6A:CC:7A:66:6F:B0',
        'E8:7F:68:92:44:CD:D7:8D:ED:A6:79:38:9F:58:0D:DC:98:65:E7:18:19:22:99:32:64:BF:5E:41:35:6B:BD:53',
      ],
    },
  },
];

// Nothing here reads the request, so it is prerendered once at build time.
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(ASSET_LINKS), {
    headers: {
      // Android refuses the file under any other type.
      'content-type': 'application/json',
    },
  });
}
