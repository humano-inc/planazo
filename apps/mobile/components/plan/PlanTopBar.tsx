import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type { PlanDerived } from '../../lib/planDerived';
import { openActionSheet, type SheetRow } from '../../lib/actionSheet';
import { useDismissTo } from '../../lib/navigation';
import { planLinkFor } from '../../lib/shareLinks';
import { BackButton, HeaderRow, MoreGlyph, showToast } from '../ui';
import { ActionButton } from '../ui/ActionButton';

type Props = {
  planId: string;
  groupId?: string | null;
  d: PlanDerived;
  /** Where back goes: the group's name, or "Home" on a plan with no group. */
  backLabel: string;
  onNudge: () => void;
};

/** The back label, the ··· menu, and the menu itself (20a). */
export function PlanTopBar({ planId, groupId, d, backLabel, onNudge }: Props) {
  const router = useRouter();
  // Deep links (push, QA) mount this as the first screen, so the back label
  // falls back to where it points rather than to nothing.
  const goBack = useDismissTo(groupId ? `/(app)/group/${groupId}` : '/(app)/(tabs)');

  const copyLink = async () => {
    await Clipboard.setStringAsync(planLinkFor(planId));
    showToast('Link copied');
  };

  // 20a: the host menu. Guests get it minus the two host rows — editing and
  // calling it off share one guard, because both are meaningless on a plan
  // that has already ended or been called off (PLA-31).
  const showMenu = () => {
    const rows: SheetRow[] = [
      // Not "invite link": this one admits nobody. The group's invite code is
      // what lets someone in, and conflating the two is how a host ends up
      // sending a stranger a link that can only tell them it isn't theirs.
      //
      // Fire-and-forget: writing to the clipboard has no failure mode worth a
      // dialog, and the toast is the confirmation.
      { label: 'Copy link to this plan', run: () => void copyLink() },
    ];
    if (d.isOpen && !d.isPast && d.unanswered > 0) {
      rows.push({
        label: `Nudge the ${d.unanswered} who ${d.unanswered === 1 ? "hasn't" : "haven't"} answered`,
        run: onNudge,
      });
    }
    if (d.isHost && !d.isCancelled && !d.isPast) {
      rows.push({
        label: 'Edit the details',
        run: () => router.push(`/plan/${planId}/edit`),
      });
      rows.push({
        label: 'Call it off',
        run: () => router.push(`/plan/${planId}/cancel`),
        destructive: true,
      });
    }
    // "Close" rather than "Cancel", which would sit directly under "Call it
    // off" and read as a second way to do it.
    openActionSheet({ androidTitle: 'Plan options', cancelLabel: 'Close', rows });
  };

  return (
    <HeaderRow
      left={
        <BackButton
          label={backLabel}
          onPress={goBack}
          testID="back"
          style={styles.backAction}
        />
      }
      right={
        <ActionButton
          accessibilityLabel="Plan options"
          align="end"
          onPress={showMenu}
          testID="plan-menu"
        >
          <MoreGlyph />
        </ActionButton>
      }
    />
  );
}

const styles = StyleSheet.create({
  backAction: {
    maxWidth: '78%',
  },
});
