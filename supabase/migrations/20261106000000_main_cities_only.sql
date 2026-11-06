-- The picker lists the cities people mean, not everywhere near them.
--
-- 20260812000000 seeded every provincial capital plus the Greater Buenos Aires
-- partidos, the Mendoza departments and the smaller cities "large enough that
-- people name them as where they live". In the picker that reads as a list of
-- neighbourhoods: Godoy Cruz next to Mendoza, Quilmes next to Buenos Aires.
--
-- What stays is the capitals, so no province is unreachable, and the handful of
-- large cities that are not one. A city can come back with a later migration;
-- its seed's `ON CONFLICT (slug) DO NOTHING` was written for exactly that.
--
-- Each city leaving names where its groups go: the nearest city staying, by the
-- seeded coordinates, even across a province line (Junín is closer to Rosario
-- than to Buenos Aires). The one exception is Goya, under a kilometre closer to
-- Resistencia than to Corrientes, which is its own capital. Groups are moved
-- rather than asked because `groups.city_id` is NOT NULL, and an admin who
-- disagrees can pick any listed city from Manage.
--
-- The foreign key is the guard on all of it. `groups.city_id` has no ON DELETE
-- action, so if a group were ever still pointing at a row below, the delete would
-- fail the whole migration rather than strand it.

CREATE TEMP TABLE city_moves (
  from_slug TEXT PRIMARY KEY,
  to_slug TEXT NOT NULL
);

INSERT INTO city_moves (from_slug, to_slug) VALUES
  -- Greater Buenos Aires
  ('la-matanza', 'buenos-aires'),
  ('quilmes', 'buenos-aires'),
  ('lanus', 'buenos-aires'),
  ('lomas-de-zamora', 'buenos-aires'),
  ('avellaneda', 'buenos-aires'),
  ('moron', 'buenos-aires'),
  ('san-isidro', 'buenos-aires'),
  ('vicente-lopez', 'buenos-aires'),
  ('tigre', 'buenos-aires'),
  ('san-miguel', 'buenos-aires'),
  ('jose-c-paz', 'buenos-aires'),
  ('moreno', 'buenos-aires'),
  ('merlo', 'buenos-aires'),
  ('ituzaingo', 'buenos-aires'),
  ('hurlingham', 'buenos-aires'),
  ('berazategui', 'buenos-aires'),
  ('florencio-varela', 'buenos-aires'),
  ('almirante-brown', 'buenos-aires'),
  ('esteban-echeverria', 'buenos-aires'),
  ('ezeiza', 'buenos-aires'),
  ('malvinas-argentinas', 'buenos-aires'),
  ('tres-de-febrero', 'buenos-aires'),
  ('general-san-martin', 'buenos-aires'),
  ('san-fernando', 'buenos-aires'),
  ('escobar', 'buenos-aires'),
  ('pilar', 'buenos-aires'),

  -- Buenos Aires province, beyond the conurbation
  ('olavarria', 'tandil'),
  ('pergamino', 'rosario'),
  ('junin', 'rosario'),
  ('lujan', 'buenos-aires'),
  ('zarate', 'buenos-aires'),
  ('campana', 'buenos-aires'),
  ('san-nicolas-de-los-arroyos', 'rosario'),
  ('necochea', 'mar-del-plata'),

  -- Córdoba
  ('villa-maria', 'rio-cuarto'),
  ('villa-carlos-paz', 'cordoba'),

  -- Santa Fe
  ('rafaela', 'santa-fe'),
  ('venado-tuerto', 'rosario'),

  -- Entre Ríos
  ('concordia', 'parana'),
  ('gualeguaychu', 'buenos-aires'),

  -- Mendoza
  ('godoy-cruz', 'mendoza'),
  ('guaymallen', 'mendoza'),
  ('las-heras', 'mendoza'),
  ('maipu', 'mendoza'),
  ('lujan-de-cuyo', 'mendoza'),

  -- The rest of the interior
  ('yerba-buena', 'san-miguel-de-tucuman'),
  ('la-banda', 'santiago-del-estero'),
  ('villa-mercedes', 'san-luis'),
  ('general-roca', 'neuquen'),
  ('cipolletti', 'neuquen'),
  ('trelew', 'rawson'),
  ('puerto-madryn', 'rawson'),
  ('rio-grande', 'ushuaia'),
  ('presidencia-roque-saenz-pena', 'resistencia'),
  ('goya', 'corrientes'),
  ('obera', 'posadas'),
  ('eldorado', 'posadas'),
  ('tartagal', 'san-salvador-de-jujuy'),
  ('general-pico', 'santa-rosa'),
  ('caleta-olivia', 'comodoro-rivadavia');

UPDATE public.groups AS g
SET city_id = destination.id
FROM public.cities AS origin
JOIN city_moves AS move ON move.from_slug = origin.slug
JOIN public.cities AS destination ON destination.slug = move.to_slug
WHERE g.city_id = origin.id;

DELETE FROM public.cities AS c
USING city_moves AS move
WHERE c.slug = move.from_slug;

DROP TABLE city_moves;
