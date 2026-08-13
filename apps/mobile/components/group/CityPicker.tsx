import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import type { City } from '@planazo/shared';
import { filterCities, citiesEmptyLine } from '../../lib/cities';
import { useCities } from '../../lib/useCities';
import { errorCopy } from '../../lib/queryErrors';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { ThemedText, Card, SearchField } from '../ui';
import { settingsStyles } from './settingsStyles';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  /** The city currently chosen, if any. Ticked in the list. */
  selectedId: string | null;
  onSelect: (city: City) => void;
}

/**
 * Search the seeded city list and pick one (PLA-88).
 *
 * The same component in both places a city is chosen: inline inside group
 * creation, and inside the change-city sheet on Manage. It owns the query as
 * well as the search box, the way `FriendPicker` owns its friends query and
 * for the same reason: nothing outside this list reads either, and a list that
 * fetches its own rows has one story about not having them yet. Handed the
 * rows as a prop instead, each caller invented its own, and the sheet's was to
 * say "No cities to choose from." while the fetch was still in flight.
 *
 * Rows carry the name and nothing else. The design draws a "Province · Country"
 * subtitle under each one, and `cities` has neither column: the table holds
 * only what an API call or the weekly job reads. A subtitle earns its column
 * the day a second country makes "Córdoba" ambiguous.
 *
 * The whole list is drawn when nothing is typed, alphabetically. It is long on
 * purpose rather than capped: a cap would quietly hide cities from someone
 * scrolling for one, and the search box directly above is the fast path.
 */
export function CityPicker({ selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const { data, isPending, isError, error } = useCities();
  const found = filterCities(data ?? [], query);

  return (
    <View style={settingsStyles.section}>
      <SearchField
        placeholder="Search cities"
        value={query}
        onChangeText={setQuery}
        testID="city-search"
      />

      <Card padded={false}>
        {found.map((city, index) => {
          const selected = city.id === selectedId;
          return (
            <Pressable
              key={city.id}
              onPress={() => onSelect(city)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={city.name}
              testID={`city-${city.slug}`}
              style={({ pressed }) => [
                styles.row,
                index > 0 && settingsStyles.divider,
                selected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <ThemedText variant="bodyStrong" numberOfLines={1} style={styles.name}>
                {city.name}
              </ThemedText>
              {selected ? (
                <View style={styles.tick} testID={`city-${city.slug}-tick`}>
                  <ThemedText variant="tag" color={colors.textOnAccent}>
                    ✓
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {found.length === 0 ? (
          <ThemedText variant="sub" style={settingsStyles.emptyLine} testID="cities-empty">
            {isPending
              ? 'Loading cities…'
              : isError
                ? errorCopy(error).body
                : citiesEmptyLine(query)}
          </ThemedText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 15,
    minHeight: MIN_TOUCH_TARGET,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
  },
  rowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  tick: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
