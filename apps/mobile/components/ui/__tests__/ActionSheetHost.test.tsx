import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { openActionSheet, type SheetRow } from '../../../lib/actionSheet';
import { colors } from '../../../theme/tokens';
import { ActionSheetHost } from '../ActionSheetHost';

const originalOS = Platform.OS;

const run = jest.fn();

/** The largest sheet the app builds: the plan menu for a host (PLA-133). */
const fourRows = (): SheetRow[] => [
  { label: 'Copy link to this plan', run: jest.fn() },
  { label: 'Nudge the 3 who have not answered', run: jest.fn() },
  { label: 'Edit the details', run: jest.fn() },
  { label: 'Call it off', run, destructive: true },
];

const openPlanMenu = async () => {
  await render(<ActionSheetHost />);
  await act(async () => {
    openActionSheet({ androidTitle: 'Plan options', cancelLabel: 'Close', rows: fourRows() });
  });
};

beforeEach(() => {
  run.mockClear();
  Platform.OS = 'android';
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe('ActionSheetHost', () => {
  it('renders nothing until a sheet is opened', async () => {
    await render(<ActionSheetHost />);

    expect(screen.queryByTestId('action-sheet')).toBeNull();
  });

  // The bug this exists for: RN's Android Alert kept the first three buttons,
  // which took "Call it off" and "Close" off the screen.
  it('shows every row and the cancel row, however many there are', async () => {
    await openPlanMenu();

    for (const row of fourRows()) {
      expect(screen.getByText(row.label)).toBeTruthy();
    }
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('runs the row that was pressed and closes', async () => {
    await openPlanMenu();

    await fireEvent.press(screen.getByText('Call it off'));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('action-sheet')).toBeNull();
  });

  it('closes without running anything from the cancel row', async () => {
    await openPlanMenu();

    await fireEvent.press(screen.getByText('Close'));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByTestId('action-sheet')).toBeNull();
  });

  it('closes without running anything from the dimmed area', async () => {
    await openPlanMenu();

    // Hidden from a screen reader, which has the cancel row. A thumb still has it.
    await fireEvent.press(
      screen.getByTestId('action-sheet-backdrop', { includeHiddenElements: true })
    );

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByTestId('action-sheet')).toBeNull();
  });

  it('closes without running anything from the back button', async () => {
    await openPlanMenu();

    await fireEvent(screen.getByTestId('action-sheet-modal'), 'requestClose');

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByTestId('action-sheet')).toBeNull();
  });

  it('marks the destructive row, and only that one', async () => {
    await openPlanMenu();

    const colorOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color;

    expect(colorOf('Call it off')).toBe(colors.accentText);
    expect(colorOf('Edit the details')).not.toBe(colors.accentText);
  });

  it('shows the title and the message, and defaults the cancel label', async () => {
    await render(<ActionSheetHost />);
    await act(async () => {
      openActionSheet({
        androidTitle: 'Group photo',
        message: 'A photo makes the group easier to spot.',
        rows: [{ label: 'Take a photo', run: jest.fn() }],
      });
    });

    expect(screen.getByText('Group photo')).toBeTruthy();
    expect(screen.getByText('A photo makes the group easier to spot.')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
