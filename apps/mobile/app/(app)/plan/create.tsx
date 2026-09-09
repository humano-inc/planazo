import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import type { PlanAudience } from '@planazo/shared';
import { useCreatePlan } from '../../../lib/useCreatePlan';
import { useMyGroups } from '../../../lib/useMyGroups';
import { useFriends } from '../../../lib/useFriends';
import {
  FRIEND_AUDIENCES,
  audienceHelper,
  isPlanAudience,
  needsPeople,
  postLabel,
} from '../../../lib/planAudience';
import { emptyPollDraft, pollDraftTouched, pollDraftValid } from '../../../lib/pollDraft';
import { PollComposer } from '../../../components/plan/PollComposer';
import { WhoField } from '../../../components/plan/WhoField';
import { WhenField } from '../../../components/plan/WhenField';
import { HowManyField } from '../../../components/plan/HowManyField';
import { NEEDS_GROUP_COPY, NeedsGroupState } from '../../../components/group/NeedsGroupState';
import { useDismissTo } from '../../../lib/navigation';
import { MIN_TOUCH_TARGET } from '../../../lib/a11y';
import {
  ThemedText,
  Button,
  FormScreen,
  HeaderAction,
  HeaderRow,
  DisclosureGlyph,
} from '../../../components/ui';
import { colors, radii, spacing } from '../../../theme/tokens';
import { type } from '../../../theme/tokens';

export default function CreatePlanScreen() {
  // Beyond groupId, the params preseed sheet state so every state is
  // reachable by deep link (dev screenshots can't tap):
  //   planazo://plan/create?title=Padel&dates=2026-08-07,2026-08-09&min=5&cap=8&details=1
  const params = useLocalSearchParams<{
    groupId?: string;
    /** "Try again" from a group-less plan lands on the same audience (PLA-140). */
    audience?: string;
    title?: string;
    dates?: string;
    time?: string;
    min?: string;
    cap?: string;
    details?: string;
    location?: string;
    y?: string;
  }>();

  const [title, setTitle] = useState(params.title ?? '');
  // A group id, or one of the two friend audiences: one row of chips, one pick.
  const [picked, setPicked] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>(() =>
    params.dates ? params.dates.split(',').filter(Boolean).sort() : []
  );
  const [time, setTime] = useState(params.time ?? '20:30');
  const [min, setMin] = useState(() => Math.min(20, Math.max(2, Number(params.min) || 4)));
  const [cap, setCap] = useState<number | null>(() =>
    Number(params.cap) > 0 ? Number(params.cap) : null
  );
  const [detailsOpen, setDetailsOpen] = useState(params.details === '1');
  // 19c "Try again with a new date" preseeds everything but the date
  const [location, setLocation] = useState(params.location ?? '');
  const [notes, setNotes] = useState('');
  // The one open question (PLA-47). Collapsed by default: most plans have no
  // question, and this flow must not grow for them.
  const [askOpen, setAskOpen] = useState(false);
  const [pollDraft, setPollDraft] = useState(emptyPollDraft());

  const { groups, hasGroups, loading: groupsLoading } = useMyGroups();
  const { friends, isPending: friendsLoading } = useFriends();
  const hasFriends = friends.length > 0;

  // Opened from a group: that group is settled and the chip row collapses to it.
  const paramGroupId = params.groupId || null;
  const choices = paramGroupId ? groups.filter((g) => g.id === paramGroupId) : groups;
  // The friend audiences (PLA-140) come first in the row, but only for someone
  // with a friend to reach: a plan for nobody is not a choice worth offering.
  const audienceChoices = hasFriends && !paramGroupId ? FRIEND_AUDIENCES : [];
  const paramAudience =
    isPlanAudience(params.audience) && params.audience !== 'group' && hasFriends
      ? params.audience
      : null;
  // The default keeps the habit: your first group when you have one, and your
  // friends only when you have none.
  const pick =
    paramGroupId ?? picked ?? paramAudience ?? choices[0]?.id ?? audienceChoices[0] ?? null;
  const audience: PlanAudience =
    pick === 'friends' || pick === 'friends_of_friends' ? pick : 'group';
  const groupId = audience === 'group' ? pick : null;
  const group = choices.find((g) => g.id === groupId) ?? null;
  const helper = audienceHelper(audience);

  const toggleDay = (iso: string) =>
    setDates((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()));

  // A half-typed question blocks the post rather than being silently
  // dropped: posting "Which film?" with one option is a poll nobody can
  // answer, and discarding typed text is worse.
  const pollBlocks = pollDraftTouched(pollDraft) && !pollDraftValid(pollDraft);
  const isValid =
    title.trim().length > 0 &&
    dates.length > 0 &&
    (audience !== 'group' || !!groupId) &&
    !pollBlocks;

  const createPlan = useCreatePlan();

  // `planazo://plan/create` opens this sheet with nothing behind it, and
  // back() is a no-op there: Cancel did nothing at all on a cold deep link.
  const cancel = useDismissTo('/(app)/(tabs)');

  // The form below cannot be completed with nobody to post to, so it is not
  // offered: that empty chip row and its permanently disabled "Post to …" were
  // the dead end PLA-68 was reported for. The "+" already sends this user to
  // the needs-group sheet, but this route is a live deep link nothing guards.
  const needsAnyone = !groupsLoading && !friendsLoading && needsPeople(hasGroups, hasFriends);

  const header = (
    <HeaderRow
      left={<HeaderAction label="Cancel" onPress={cancel} tone="muted" testID="cancel" />}
      rightSpacerWidth={48}
      title="New plan"
    />
  );

  // Nothing to post to, so nothing to compose: the form is replaced outright
  // rather than shown behind a disabled button (PLA-68). No footer either —
  // the way out of this state is inside the empty state itself.
  if (needsAnyone) {
    return (
      <FormScreen header={header} contentContainerStyle={styles.emptyContent} testID="create-empty">
        <NeedsGroupState
          body={NEEDS_GROUP_COPY.planBody}
          dismissFirst
          testID="create-needs-group"
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      header={header}
      contentContainerStyle={styles.content}
      contentOffset={params.y ? { x: 0, y: Number(params.y) } : undefined}
      testID="create"
      footer={
        <Button
          label={createPlan.isPending ? 'Posting…' : postLabel(audience, group?.name ?? null)}
          variant={isValid ? 'primary' : 'secondary'}
          disabled={!isValid || createPlan.isPending}
          haptic={isValid}
          onPress={() =>
            createPlan.mutate({
              audience,
              groupId,
              title,
              dates,
              time,
              min,
              cap,
              location,
              notes,
              pollDraft,
            })
          }
          testID="post-cta"
        />
      }
    >
      <View style={styles.titleBlock}>
        <TextInput
          style={styles.titleInput}
          placeholder="Padel? Paella? Poker?"
          placeholderTextColor={colors.textFaint}
          value={title}
          onChangeText={setTitle}
          testID="title-input"
        />
        <View style={styles.rule} />
      </View>

      <WhoField
        audiences={audienceChoices}
        groups={choices}
        audience={audience}
        groupId={groupId}
        onPick={setPicked}
        helper={helper}
      />

      <WhenField dates={dates} onToggleDay={toggleDay} time={time} onTimeChange={setTime} />

      <HowManyField min={min} cap={cap} onMinChange={setMin} onCapChange={setCap} />

      <View style={styles.section}>
        <Pressable
          onPress={() => setDetailsOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          testID="details-toggle"
          style={styles.detailsToggle}
        >
          <ThemedText variant="bodyStrong" color={colors.accent}>
            {detailsOpen ? 'Hide extras' : 'Add place & notes'}
          </ThemedText>
          <DisclosureGlyph expanded={detailsOpen} color={colors.accentText} />
        </Pressable>
        {detailsOpen ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.detailsFields}>
            <TextInput
              style={styles.input}
              placeholder="Where's it happening?"
              placeholderTextColor={colors.textFaint}
              value={location}
              onChangeText={setLocation}
              testID="location-input"
            />
            <TextInput
              style={[styles.input, styles.notes]}
              placeholder="Anything they should know? Bring cash, wear trainers…"
              placeholderTextColor={colors.textFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
              testID="notes-input"
            />
          </Animated.View>
        ) : null}
      </View>

      {/* The one open question (PLA-47): same disclosure pattern as the
          details, because most plans have no question and this flow must
          not grow for them. */}
      <View style={styles.section}>
        <Pressable
          onPress={() => setAskOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: askOpen }}
          testID="poll-toggle"
          style={styles.detailsToggle}
        >
          <ThemedText variant="bodyStrong" color={colors.accent}>
            {askOpen ? 'Hide the question' : 'Add a question to vote on'}
          </ThemedText>
          <DisclosureGlyph expanded={askOpen} color={colors.accentText} />
        </Pressable>
        {askOpen ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.detailsFields}>
            <PollComposer draft={pollDraft} onChange={setPollDraft} />
          </Animated.View>
        ) : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6,
    gap: 22,
  },
  // The empty state fills the screen rather than sitting under the header.
  emptyContent: {
    flexGrow: 1,
  },
  titleBlock: {
    gap: 10,
  },
  titleInput: {
    ...type.screenTitle,
    padding: 0,
  },
  rule: {
    height: 2,
    backgroundColor: colors.borderStrong,
  },
  section: {
    gap: 10,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  detailsFields: {
    gap: 10,
  },
  input: {
    ...type.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    padding: 15,
  },
  notes: {
    height: 88,
    textAlignVertical: 'top',
  },
});
