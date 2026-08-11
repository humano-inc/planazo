import { StyleSheet, View } from 'react-native';
import { groupColors } from '../../theme/tokens';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { ThemedText } from './ThemedText';

interface GroupColourFieldProps {
  value: string;
  onChange: (colour: string) => void;
}

/** The colour picker shared by group creation and Group profile. */
export function GroupColourField({ value, onChange }: GroupColourFieldProps) {
  return (
    <View style={styles.section}>
      <ThemedText variant="sectionLabel">Colour</ThemedText>
      <ColorSwatchPicker
        swatches={groupColors}
        selected={value}
        onSelect={(colour) => onChange(colour)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
});
