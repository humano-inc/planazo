// place-search: real places matching what a host is typing (PLA-156).
//
// A function rather than a call from the app for two reasons: the Google key
// stays on the server, and swapping the provider touches only this directory.
//
// Runs with verify_jwt on, so only a signed-in person can spend our quota. The
// query is never logged: it is what someone typed, and it is not ours to keep.
// Nothing Google returns is stored here either, which its terms forbid.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { AUTOCOMPLETE_FIELD_MASK, autocompleteBody, toSuggestions, validQuery } from './suggestions.ts';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
// Where a person with no group searches. Planazo starts in Mendoza.
const DEFAULT_CITY_SLUG = 'mendoza';

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  let input: { q?: unknown; cityId?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const q = validQuery(input.q);
  if (!q) return json({ error: 'bad_query' }, 400);

  // As the caller, because `cities` is readable by anyone signed in.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const columns = 'lat, lon, country_code';
  const { data: chosen } =
    typeof input.cityId === 'string'
      ? await supabase.from('cities').select(columns).eq('id', input.cityId).maybeSingle()
      : { data: null };
  const city =
    chosen ??
    (await supabase.from('cities').select(columns).eq('slug', DEFAULT_CITY_SLUG).single()).data;
  if (!city) return json({ error: 'no_city' }, 500);

  const response = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify(autocompleteBody(q, city)),
  });
  if (!response.ok) {
    console.error('places autocomplete failed', response.status);
    return json({ error: 'upstream' }, 502);
  }
  return json({ suggestions: toSuggestions(await response.json()) });
});
