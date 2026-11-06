import { Platform } from 'react-native';
import { openActionSheet } from './actionSheet';
import { appleMapsUrl, googleMapsUrl, type MapCenter } from './mapLinks';
import { openLink } from './openLink';

/**
 * Take someone to a place in the maps app they use.
 *
 * An iPhone can have either, so it asks. Android has no Apple Maps to offer, and
 * a sheet with one choice is only an extra tap.
 */
export function openInMaps(
  location: string,
  near: MapCenter | null,
  placeId: string | null
): void {
  const google = () => openLink(googleMapsUrl(location, placeId));
  if (Platform.OS !== 'ios') {
    google();
    return;
  }
  openActionSheet({
    androidTitle: 'Open in',
    rows: [
      { label: 'Apple Maps', run: () => openLink(appleMapsUrl(location, near)) },
      { label: 'Google Maps', run: google },
    ],
  });
}
