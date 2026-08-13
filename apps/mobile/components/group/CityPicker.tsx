import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import type { City } from '@planazo/shared';
import { filterCities, citiesEmptyLine } from '../../lib/cities';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { ThemedText, Card, SearchField } from '../ui';
import { settingsStyles } from './settingsStyles';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
  cities: City[];
  /** The city currently chosen, if any. Ticked in the list. */
  selectedId: string | null;
  onSelect: (city: City) => void;
}

/**
 * Search the seeded city list and pick one (PLA-88).
 *
 * The same component in both places a city is chosen: inline inside group
 * creation, and inside the change-city sheet on Manage. It owns the search box
 * and its own query state, because the query is scratch: nothing outside cares
 * what was typed, only which city came out.
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
export function CityPicker({ cities, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const found = filterCities(cities, query);

  return (
    <View style={styles.stack}>
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
                  <ThemedText variant="caption" color={colors.textOnAccent}>
                    ✓
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {found.length === 0 ? (
          <ThemedText variant="sub" style={styles.emptyLine} testID="cities-empty">
            {citiesEmptyLine(query)}
          </ThemedText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
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
  emptyLine: {
    paddingVertical: 26,
    paddingHorizontal: spacing.xl,
    textAlign: 'center',
  },
});
