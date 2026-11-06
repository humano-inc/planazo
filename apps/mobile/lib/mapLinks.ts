export interface MapCenter {
  lat: number;
  lon: number;
}

/**
 * Where a place opens (PLA-155): a search for the words the host wrote, in each
 * maps app. Both are plain https links, so they need no key and no native
 * config, and each app takes its own link when installed.
 */
export function googleMapsUrl(location: string, placeId: string | null): string {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  return placeId ? `${url}&query_place_id=${encodeURIComponent(placeId)}` : url;
}

/**
 * `sll` tells Apple where to search. A phone with its location off has nothing
 * else to go on, and "Cerro Arco trailhead" opened a neighbourhood in Idaho.
 * Apple only ever gets the host's words and a city: this link must stay free of
 * anything that came from Google Places, whose terms bar use with other maps.
 */
export function appleMapsUrl(location: string, near: MapCenter | null): string {
  const url = `https://maps.apple.com/?q=${encodeURIComponent(location.trim())}`;
  return near ? `${url}&sll=${near.lat},${near.lon}` : url;
}
