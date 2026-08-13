-- PLA-88: a group belongs to a city.
--
-- The city is what makes a proposed idea reachable, and it is the cache key
-- that keeps the idea engine's API cost flat: every group in one city shares
-- one fetch of what is on there, however many groups that is.
--
-- Three things follow from that, and they are why this is one migration:
--
--   1. Cities are a seeded table, not a Places API. A bounded set is what
--      makes the cache key bounded; an open-ended geocoder would give every
--      group its own spelling of the same place and one fetch each.
--   2. `groups.city_id` is NOT NULL from day one. A nullable column would need
--      a no-city state in every screen that reads it, and an "add a city"
--      flow nobody would ever see twice. Existing groups are backfilled before
--      the constraint goes on.
--   3. `create_group` grows a required argument rather than a defaulted one,
--      so a client that forgets the city fails loudly instead of quietly
--      creating a group the idea engine cannot serve.


-- 1. The cities ---------------------------------------------------------------
--
-- Coordinates because both Ticketmaster and Google Places query by geo radius,
-- and the timezone because the weekly job has to fire in the group's own
-- morning rather than the server's.
--
-- Deliberately minimal: no province, no population, no region. Every column
-- here is one an API call or a scheduler reads. A province column would exist
-- only to draw a subtitle, and a picker row that says "Córdoba · Argentina"
-- under "Córdoba" earns its space only once a second country does.

CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  timezone TEXT NOT NULL
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Reference data: everyone signed in reads the whole list, and nobody writes
-- it from the app. The absence of INSERT/UPDATE/DELETE policies is the write
-- protection, exactly as with any other seeded lookup.
CREATE POLICY "Anyone signed in can read cities"
  ON public.cities FOR SELECT
  TO authenticated
  USING (true);

-- The seed lives in the migration rather than a seeder script, so a fresh
-- branch database and production get the identical list without anyone
-- remembering to run something. `ON CONFLICT (slug) DO NOTHING` follows
-- app_admins in 20260811000001: re-running is a no-op, and a later migration
-- adding cities never fights this one.
--
-- Who is on the list: every provincial capital and CABA, so no province is
-- unreachable, plus the cities and Greater Buenos Aires partidos large enough
-- that people name them as where they live. Argentina only, because that is
-- where Planazo launches; a second country is a second seed migration, not a
-- schema change.
--
-- Timezones are per-province IANA zones rather than one blanket
-- America/Argentina/Buenos_Aires. Every one of them is UTC-3 today, so nothing
-- observable turns on the distinction now. It is recorded correctly because
-- the alternative is discovering the wrong offset from a job that fired at the
-- wrong hour.

INSERT INTO public.cities (slug, name, country_code, lat, lon, timezone) VALUES
  -- Capitals, and CABA
  ('buenos-aires', 'Buenos Aires', 'AR', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'),
  ('la-plata', 'La Plata', 'AR', -34.9215, -57.9545, 'America/Argentina/Buenos_Aires'),
  ('cordoba', 'Córdoba', 'AR', -31.4201, -64.1888, 'America/Argentina/Cordoba'),
  ('santa-fe', 'Santa Fe', 'AR', -31.6333, -60.7000, 'America/Argentina/Cordoba'),
  ('parana', 'Paraná', 'AR', -31.7333, -60.5333, 'America/Argentina/Cordoba'),
  ('corrientes', 'Corrientes', 'AR', -27.4692, -58.8306, 'America/Argentina/Cordoba'),
  ('posadas', 'Posadas', 'AR', -27.3671, -55.8961, 'America/Argentina/Cordoba'),
  ('resistencia', 'Resistencia', 'AR', -27.4514, -58.9867, 'America/Argentina/Cordoba'),
  ('formosa', 'Formosa', 'AR', -26.1775, -58.1781, 'America/Argentina/Cordoba'),
  ('santiago-del-estero', 'Santiago del Estero', 'AR', -27.7951, -64.2615, 'America/Argentina/Cordoba'),
  ('san-miguel-de-tucuman', 'San Miguel de Tucumán', 'AR', -26.8083, -65.2176, 'America/Argentina/Tucuman'),
  ('salta', 'Salta', 'AR', -24.7859, -65.4117, 'America/Argentina/Salta'),
  ('san-salvador-de-jujuy', 'San Salvador de Jujuy', 'AR', -24.1858, -65.2995, 'America/Argentina/Jujuy'),
  ('catamarca', 'San Fernando del Valle de Catamarca', 'AR', -28.4696, -65.7852, 'America/Argentina/Catamarca'),
  ('la-rioja', 'La Rioja', 'AR', -29.4111, -66.8508, 'America/Argentina/La_Rioja'),
  ('san-juan', 'San Juan', 'AR', -31.5375, -68.5364, 'America/Argentina/San_Juan'),
  ('mendoza', 'Mendoza', 'AR', -32.8895, -68.8458, 'America/Argentina/Mendoza'),
  ('san-luis', 'San Luis', 'AR', -33.3017, -66.3378, 'America/Argentina/San_Luis'),
  ('santa-rosa', 'Santa Rosa', 'AR', -36.6167, -64.2833, 'America/Argentina/Salta'),
  ('neuquen', 'Neuquén', 'AR', -38.9516, -68.0591, 'America/Argentina/Salta'),
  ('viedma', 'Viedma', 'AR', -40.8135, -62.9967, 'America/Argentina/Salta'),
  ('rawson', 'Rawson', 'AR', -43.3002, -65.1023, 'America/Argentina/Catamarca'),
  ('rio-gallegos', 'Río Gallegos', 'AR', -51.6230, -69.2168, 'America/Argentina/Rio_Gallegos'),
  ('ushuaia', 'Ushuaia', 'AR', -54.8019, -68.3030, 'America/Argentina/Ushuaia'),

  -- Greater Buenos Aires
  ('la-matanza', 'La Matanza', 'AR', -34.6767, -58.5606, 'America/Argentina/Buenos_Aires'),
  ('quilmes', 'Quilmes', 'AR', -34.7203, -58.2543, 'America/Argentina/Buenos_Aires'),
  ('lanus', 'Lanús', 'AR', -34.7069, -58.3936, 'America/Argentina/Buenos_Aires'),
  ('lomas-de-zamora', 'Lomas de Zamora', 'AR', -34.7611, -58.4006, 'America/Argentina/Buenos_Aires'),
  ('avellaneda', 'Avellaneda', 'AR', -34.6625, -58.3650, 'America/Argentina/Buenos_Aires'),
  ('moron', 'Morón', 'AR', -34.6534, -58.6198, 'America/Argentina/Buenos_Aires'),
  ('san-isidro', 'San Isidro', 'AR', -34.4708, -58.5075, 'America/Argentina/Buenos_Aires'),
  ('vicente-lopez', 'Vicente López', 'AR', -34.5264, -58.4756, 'America/Argentina/Buenos_Aires'),
  ('tigre', 'Tigre', 'AR', -34.4264, -58.5797, 'America/Argentina/Buenos_Aires'),
  ('san-miguel', 'San Miguel', 'AR', -34.5433, -58.7128, 'America/Argentina/Buenos_Aires'),
  ('jose-c-paz', 'José C. Paz', 'AR', -34.5150, -58.7550, 'America/Argentina/Buenos_Aires'),
  ('moreno', 'Moreno', 'AR', -34.6503, -58.7896, 'America/Argentina/Buenos_Aires'),
  ('merlo', 'Merlo', 'AR', -34.6653, -58.7275, 'America/Argentina/Buenos_Aires'),
  ('ituzaingo', 'Ituzaingó', 'AR', -34.6581, -58.6672, 'America/Argentina/Buenos_Aires'),
  ('hurlingham', 'Hurlingham', 'AR', -34.5883, -58.6394, 'America/Argentina/Buenos_Aires'),
  ('berazategui', 'Berazategui', 'AR', -34.7656, -58.2100, 'America/Argentina/Buenos_Aires'),
  ('florencio-varela', 'Florencio Varela', 'AR', -34.8256, -58.2764, 'America/Argentina/Buenos_Aires'),
  ('almirante-brown', 'Almirante Brown', 'AR', -34.8000, -58.3900, 'America/Argentina/Buenos_Aires'),
  ('esteban-echeverria', 'Esteban Echeverría', 'AR', -34.8167, -58.4667, 'America/Argentina/Buenos_Aires'),
  ('ezeiza', 'Ezeiza', 'AR', -34.8533, -58.5228, 'America/Argentina/Buenos_Aires'),
  ('malvinas-argentinas', 'Malvinas Argentinas', 'AR', -34.5033, -58.6994, 'America/Argentina/Buenos_Aires'),
  ('tres-de-febrero', 'Tres de Febrero', 'AR', -34.6058, -58.5622, 'America/Argentina/Buenos_Aires'),
  ('general-san-martin', 'General San Martín', 'AR', -34.5726, -58.5375, 'America/Argentina/Buenos_Aires'),
  ('san-fernando', 'San Fernando', 'AR', -34.4411, -58.5589, 'America/Argentina/Buenos_Aires'),
  ('escobar', 'Escobar', 'AR', -34.3486, -58.7936, 'America/Argentina/Buenos_Aires'),
  ('pilar', 'Pilar', 'AR', -34.4586, -58.9142, 'America/Argentina/Buenos_Aires'),

  -- Buenos Aires province, beyond the conurbation
  ('mar-del-plata', 'Mar del Plata', 'AR', -38.0055, -57.5426, 'America/Argentina/Buenos_Aires'),
  ('bahia-blanca', 'Bahía Blanca', 'AR', -38.7183, -62.2661, 'America/Argentina/Buenos_Aires'),
  ('tandil', 'Tandil', 'AR', -37.3217, -59.1332, 'America/Argentina/Buenos_Aires'),
  ('olavarria', 'Olavarría', 'AR', -36.8927, -60.3225, 'America/Argentina/Buenos_Aires'),
  ('pergamino', 'Pergamino', 'AR', -33.8894, -60.5739, 'America/Argentina/Buenos_Aires'),
  ('junin', 'Junín', 'AR', -34.5836, -60.9433, 'America/Argentina/Buenos_Aires'),
  ('lujan', 'Luján', 'AR', -34.5703, -59.1050, 'America/Argentina/Buenos_Aires'),
  ('zarate', 'Zárate', 'AR', -34.0958, -59.0289, 'America/Argentina/Buenos_Aires'),
  ('campana', 'Campana', 'AR', -34.1633, -58.9592, 'America/Argentina/Buenos_Aires'),
  ('san-nicolas-de-los-arroyos', 'San Nicolás de los Arroyos', 'AR', -33.3358, -60.2119, 'America/Argentina/Buenos_Aires'),
  ('necochea', 'Necochea', 'AR', -38.5545, -58.7396, 'America/Argentina/Buenos_Aires'),

  -- Córdoba
  ('rio-cuarto', 'Río Cuarto', 'AR', -33.1301, -64.3499, 'America/Argentina/Cordoba'),
  ('villa-maria', 'Villa María', 'AR', -32.4103, -63.2400, 'America/Argentina/Cordoba'),
  ('villa-carlos-paz', 'Villa Carlos Paz', 'AR', -31.4241, -64.4978, 'America/Argentina/Cordoba'),

  -- Santa Fe
  ('rosario', 'Rosario', 'AR', -32.9442, -60.6505, 'America/Argentina/Cordoba'),
  ('rafaela', 'Rafaela', 'AR', -31.2503, -61.4867, 'America/Argentina/Cordoba'),
  ('venado-tuerto', 'Venado Tuerto', 'AR', -33.7458, -61.9686, 'America/Argentina/Cordoba'),

  -- Entre Ríos
  ('concordia', 'Concordia', 'AR', -31.3930, -58.0209, 'America/Argentina/Cordoba'),
  ('gualeguaychu', 'Gualeguaychú', 'AR', -33.0092, -58.5172, 'America/Argentina/Cordoba'),

  -- Mendoza
  ('godoy-cruz', 'Godoy Cruz', 'AR', -32.9250, -68.8417, 'America/Argentina/Mendoza'),
  ('guaymallen', 'Guaymallén', 'AR', -32.8900, -68.7900, 'America/Argentina/Mendoza'),
  ('las-heras', 'Las Heras', 'AR', -32.8500, -68.8333, 'America/Argentina/Mendoza'),
  ('maipu', 'Maipú', 'AR', -32.9833, -68.7833, 'America/Argentina/Mendoza'),
  ('lujan-de-cuyo', 'Luján de Cuyo', 'AR', -33.0333, -68.8833, 'America/Argentina/Mendoza'),
  ('san-rafael', 'San Rafael', 'AR', -34.6177, -68.3301, 'America/Argentina/Mendoza'),

  -- The rest of the interior
  ('yerba-buena', 'Yerba Buena', 'AR', -26.8167, -65.3167, 'America/Argentina/Tucuman'),
  ('la-banda', 'La Banda', 'AR', -27.7333, -64.2500, 'America/Argentina/Cordoba'),
  ('villa-mercedes', 'Villa Mercedes', 'AR', -33.6757, -65.4578, 'America/Argentina/San_Luis'),
  ('san-carlos-de-bariloche', 'San Carlos de Bariloche', 'AR', -41.1335, -71.3103, 'America/Argentina/Salta'),
  ('general-roca', 'General Roca', 'AR', -39.0333, -67.5833, 'America/Argentina/Salta'),
  ('cipolletti', 'Cipolletti', 'AR', -38.9333, -68.0000, 'America/Argentina/Salta'),
  ('comodoro-rivadavia', 'Comodoro Rivadavia', 'AR', -45.8642, -67.4966, 'America/Argentina/Catamarca'),
  ('trelew', 'Trelew', 'AR', -43.2489, -65.3050, 'America/Argentina/Catamarca'),
  ('puerto-madryn', 'Puerto Madryn', 'AR', -42.7692, -65.0385, 'America/Argentina/Catamarca'),
  ('rio-grande', 'Río Grande', 'AR', -53.7877, -67.7093, 'America/Argentina/Ushuaia'),
  ('presidencia-roque-saenz-pena', 'Presidencia Roque Sáenz Peña', 'AR', -26.7852, -60.4388, 'America/Argentina/Cordoba'),
  ('goya', 'Goya', 'AR', -29.1400, -59.2600, 'America/Argentina/Cordoba'),
  ('obera', 'Oberá', 'AR', -27.4869, -55.1197, 'America/Argentina/Cordoba'),
  ('eldorado', 'Eldorado', 'AR', -26.4000, -54.6167, 'America/Argentina/Cordoba'),
  ('tartagal', 'Tartagal', 'AR', -22.5167, -63.8000, 'America/Argentina/Salta'),
  ('general-pico', 'General Pico', 'AR', -35.6578, -63.7569, 'America/Argentina/Salta'),
  ('caleta-olivia', 'Caleta Olivia', 'AR', -46.4383, -67.5283, 'America/Argentina/Rio_Gallegos')
ON CONFLICT (slug) DO NOTHING;


-- 2. Every group has one -----------------------------------------------------
--
-- Nullable, then backfilled, then constrained. Doing it in that order is what
-- lets the column land on a populated table without a default nobody wants:
-- a DEFAULT would silently give a future group whichever city was fashionable
-- when this ran, and the whole point is that a group's city is chosen.
--
-- Mendoza for the backfill because that is where the groups that exist today
-- actually meet. This is a pre-launch backfill of a handful of rows, not a
-- policy: a later group in another city picks its own.

ALTER TABLE public.groups
  ADD COLUMN city_id UUID REFERENCES public.cities(id);

-- Every row, no predicate: the column did not exist a statement ago, so there
-- is no partial state a WHERE could be selecting out of.
UPDATE public.groups
SET city_id = (SELECT id FROM public.cities WHERE slug = 'mendoza');

ALTER TABLE public.groups
  ALTER COLUMN city_id SET NOT NULL;

-- For the weekly idea job's second step. Counting groups per city is a scan
-- whatever this does; what the index serves is the `WHERE city_id = $1` that
-- comes after it, once the job knows which city it is posting into. Nothing
-- reads groups by city yet, so today this is one btree kept warm on trust.
CREATE INDEX groups_city_idx ON public.groups (city_id);

-- 20260807000000 revoked table-level SELECT on groups and re-granted a column
-- list, to keep invite_code off the client. Its own comment predicted this:
-- "a column added to this table later is unreadable from the client until it
-- is named here". Without this line every screen that reads the city gets
-- "permission denied for table groups", and it is not RLS that says so.
GRANT SELECT (city_id) ON public.groups TO authenticated;


-- 3. create_group requires one -----------------------------------------------
--
-- `p_city_id` has no default on purpose. A defaulted argument would let a
-- client that has not been updated keep creating groups, and they would all
-- land in whichever city the default named. The 3-argument overload is dropped
-- rather than left beside this one, because an overload that still works is
-- the same problem wearing a different signature.
--
-- Both callers are in this repo: the app and the integration testbed, updated
-- in the same PR. Nothing else has the grant.

CREATE OR REPLACE FUNCTION public.create_group(
  p_name TEXT,
  p_city_id UUID,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
)
RETURNS public.groups AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := NULLIF(TRIM(p_name), '');
  v_group public.groups%ROWTYPE;
  v_attempt INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'A group needs a name';
  END IF;

  IF p_city_id IS NULL THEN
    RAISE EXCEPTION 'A group needs a city';
  END IF;

  FOR v_attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public.groups (name, description, color, city_id, invite_code, created_by)
      VALUES (
        v_name,
        NULLIF(TRIM(COALESCE(p_description, '')), ''),
        COALESCE(p_color, public.color_for_name(v_name)),
        p_city_id,
        public.generate_invite_code(),
        v_uid
      )
      RETURNING * INTO v_group;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- groups.invite_code is the only unique column on the table, so this can
      -- only be a code collision. Redraw.
      IF v_attempt = 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group.id, v_uid, 'admin');

  RETURN v_group;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.create_group(TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.create_group(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.cities IS
  'Seeded reference data. The bounded set of places a group can meet in, and the cache key the idea engine fetches per.';

COMMENT ON COLUMN public.groups.city_id IS
  'Where the group meets. Required, changeable by an admin, never clearable.';
