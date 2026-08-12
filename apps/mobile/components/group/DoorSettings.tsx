import { View } from 'react-native';
import { ThemedText, Card } from '../ui';
import { PrefSwitchRow } from './PrefSwitchRow';
import { settingsStyles } from './settingsStyles';
import { joinModeOf, whoCanInviteOf, type JoinMode, type WhoCanInvite } from '../../lib/groupDoor';

interface Props {
  whoCanInvite: string | null | undefined;
  joinMode: string | null | undefined;
  onChange: (door: { whoCanInvite?: WhoCanInvite; joinMode?: JoinMode }) => void;
  pending: boolean;
  isAdmin: boolean;
}

/**
 * "Who gets in": the two dials from PLA-49, for the admins who own them.
 *
 * A member used to see both, greyed out, so that whoever could not find the
 * Invite button got to see why. That answer is now a sentence in "How it runs"
 * (`memberLimits`), which says the same thing without a switch that ignores the
 * finger on it (PLA-61).
 */
export function DoorSettings({ whoCanInvite, joinMode, onChange, pending, isAdmin }: Props) {
  if (!isAdmin) return null;

  const adminsOnly = whoCanInviteOf(whoCanInvite) === 'admins';
  const needsApproval = joinModeOf(joinMode) === 'approval';

  return (
    <View style={settingsStyles.section}>
      <ThemedText variant="sectionLabel">Who gets in</ThemedText>
      <Card padded={false}>
        <PrefSwitchRow
          label="Only admins can invite"
          caption="Off means any member can share the link"
          value={adminsOnly}
          disabled={pending}
          onChange={(on) => onChange({ whoCanInvite: on ? 'admins' : 'members' })}
          testID="pref-admins-invite"
        />
        <PrefSwitchRow
          label="Approve people who use the link"
          caption="Off means the link lets them straight in"
          value={needsApproval}
          disabled={pending}
          onChange={(on) => onChange({ joinMode: on ? 'approval' : 'open' })}
          divided
          testID="pref-join-approval"
        />
      </Card>
      <ThemedText variant="caption" style={settingsStyles.note}>
        An invite you send to someone by name always goes straight through. Approval is only for
        the link.
      </ThemedText>
    </View>
  );
}
