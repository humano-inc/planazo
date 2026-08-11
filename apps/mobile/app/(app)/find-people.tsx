import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useFriends } from '../../lib/useFriends';
import {
  MIN_SEARCH_LENGTH,
  cleanPeopleQuery,
  partitionPendingFriendships,
  relationOf,
  searchResultsWithNotes,
  sharedPeopleFrom,
  type PersonRow,
} from '../../lib/people';
import { MIN_TOUCH_TARGET } from '../../lib/a11y';
import { useDismissTo } from '../../lib/navigation';
import {
  ThemedText,
  Card,
  Avatar,
  BackButton,
  FormScreen,
  HeaderRow,
  SearchField,
} from '../../components/ui';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

/** Every answer send_friend_request gives. */
type FriendRequestStatus =
  | 'accepted'
  | 'already_friends'
  | 'already_requested'
  | 'requested'
  | 'you_blocked_them';

export default function FindPeopleScreen() {
  // The only way in is the Groups tab, which is where the chevron points.
  const goBack = useDismissTo('/(app)/(tabs)/groups');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  // Requests fired from this screen, so Add flips in place without a refetch
  const [sentTo, setSentTo] = useState<Record<string, true>>({});

  const { friends } = useFriends();
  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const { data: pending } = useQuery({
    queryKey: ['friendships-pending', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .eq('status', 'pending')
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`);
      if (error) throw error;
      return partitionPendingFriendships(data, user?.id);
    },
    enabled: !!user,
  });

  // Everyone I share a group with, with the group's name for "both in X"
  const { data: sharedPeople } = useQuery({
    queryKey: ['shared-people', user?.id],
    queryFn: async (): Promise<PersonRow[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(
          `group_id,
          groups:group_id(name, group_members(user_id, profile:profiles(id, display_name, handle, avatar_url)))`
        )
        .eq('user_id', user!.id);
      if (error) throw error;
      return sharedPeopleFrom(data, user?.id);
    },
    enabled: !!user,
  });

  const cleanQuery = cleanPeopleQuery(query);
  const { data: results } = useQuery({
    queryKey: ['people-search', cleanQuery],
    queryFn: async (): Promise<PersonRow[]> => {
      // Server-side on purpose: the results must omit anyone who blocked this
      // user, and that list is exactly what RLS keeps the client from reading.
      const { data, error } = await supabase.rpc('search_people', {
        p_query: cleanQuery,
      });
      if (error) throw error;
      return searchResultsWithNotes(data, sharedPeople ?? []);
    },
    enabled: !!user && cleanQuery.length >= MIN_SEARCH_LENGTH,
  });

  const sendRequest = useMutation({
    mutationFn: async (personId: string) => {
      const { data, error } = await supabase.rpc('send_friend_request', {
        p_addressee: personId,
      });
      if (error) throw error;
      // The RPC answers with a jsonb envelope, which the generated types can
      // only call `Json`. These are every status send_friend_request returns
      // (20260804000002_block_shield.sql).
      const answer = data as { status: FriendRequestStatus } | null;
      return { personId, status: answer?.status };
    },
    onSuccess: ({ personId, status }) => {
      // The one status that should not flip Add to Requested: the block is the
      // caller's own, so the answer is honest and actionable.
      if (status === 'you_blocked_them') {
        Alert.alert(
          'You blocked them',
          'Unblock them first, from Blocked people in your profile.',
        );
        return;
      }
      setSentTo((prev) => ({ ...prev, [personId]: true }));
      // A crossing request auto-accepts: refresh friends and the invites badge
      if (status === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['invites'] });
        queryClient.invalidateQueries({ queryKey: ['friendships-pending'] });
      }
    },
    onError: (error: Error) => Alert.alert('Error', error.message),
  });

  const relationFor = (id: string) => relationOf({ friendIds, sentTo, pending }, id);

  const renderAction = (person: PersonRow) => {
    const relation = relationFor(person.id);
    if (relation === 'friend') {
      return (
        <View style={[styles.pill, styles.pillMuted]}>
          <ThemedText variant="bodyStrong" color={colors.textMuted} style={styles.pillLabel}>
            Friends
          </ThemedText>
        </View>
      );
    }
    if (relation === 'requested') {
      return (
        <View style={[styles.pill, styles.pillMuted]} testID={`requested-${person.id}`}>
          <ThemedText variant="bodyStrong" color={colors.textMuted} style={styles.pillLabel}>
            Requested
          </ThemedText>
        </View>
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => sendRequest.mutate(person.id)}
        style={({ pressed }) => [styles.pill, styles.pillAdd, pressed && styles.pressed]}
        testID={`add-${person.id}`}
      >
        <ThemedText variant="bodyStrong" color={colors.textOnAccent} style={styles.pillLabel}>
          {relation === 'incoming' ? 'Accept' : 'Add'}
        </ThemedText>
      </Pressable>
    );
  };

  const renderRows = (people: PersonRow[]) => (
    <Card padded={false}>
      {people.map((p, i) => (
        <View key={p.id} style={[styles.personRow, i > 0 && styles.divider]}>
          <Avatar name={p.name} size={42} imageUrl={p.avatarUrl} />
          <View style={styles.personBody}>
            <ThemedText variant="bodyStrong" style={styles.personName} numberOfLines={1}>
              {p.name}
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={1}>
              {p.handle ? `@${p.handle}` : ''}
              {p.handle && p.note ? ' · ' : ''}
              {p.note ?? ''}
            </ThemedText>
          </View>
          {renderAction(p)}
        </View>
      ))}
    </Card>
  );

  const searching = cleanQuery.length >= MIN_SEARCH_LENGTH;
  // Keep just-requested people visible — Add becomes Requested in place (17b)
  const suggestions = (sharedPeople ?? []).filter((p) => relationFor(p.id) !== 'friend');

  // The search box is fixed above the scroll rather than in it: it is the one
  // control this screen is for, and it autofocuses, so it must not be the first
  // thing a raised keyboard pushes away.
  const header = (
    <>
      <HeaderRow
        layout="leading"
        left={<BackButton onPress={goBack} testID="back" color={colors.textPrimary} />}
        style={styles.headerLayout}
        title="Find people"
        titleStyle={styles.navTitle}
      />

      <View style={styles.searchWrap}>
        <SearchField
          placeholder="Name or @handle"
          value={query}
          onChangeText={setQuery}
          autoFocus
          testID="search-input"
        />
      </View>
    </>
  );

  return (
    <FormScreen header={header} contentContainerStyle={styles.content} testID="find-people">
      {searching ? (
        <View style={styles.section}>
          <ThemedText variant="sectionLabel">Results</ThemedText>
          {(results ?? []).length === 0 ? (
            <ThemedText variant="sub">No one by that name or handle yet.</ThemedText>
          ) : (
            renderRows(results ?? [])
          )}
        </View>
      ) : (
        <>
          {suggestions.length > 0 ? (
            <View style={styles.section}>
              <ThemedText variant="sectionLabel">You've planned together</ThemedText>
              {renderRows(suggestions)}
            </View>
          ) : null}

          {friends.length > 0 ? (
            <View style={styles.section}>
              <ThemedText variant="sectionLabel">Your people</ThemedText>
              {renderRows(
                friends.map((f) => ({
                  id: f.id,
                  name: f.name,
                  handle: f.handle,
                  avatarUrl: f.avatarUrl,
                  note: null,
                }))
              )}
            </View>
          ) : null}
        </>
      )}

      <ThemedText variant="caption" color={colors.textFaint} style={styles.footnote}>
        People can only find you by your name or @handle. Your plans and groups stay hidden
        until you accept.
      </ThemedText>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  headerLayout: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  navTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 14,
  },
  content: {
    gap: spacing.xl,
  },
  section: {
    gap: 10,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  personBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  personName: {
    fontSize: 16,
    lineHeight: 20,
  },
  // 38 (9 + 20 + 9) — "Add" is the whole point of this screen. The person row
  // around it is 60+, so this grows into space it already had (PLA-40).
  pill: {
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  pillAdd: {
    backgroundColor: colors.accent,
  },
  pillMuted: {
    backgroundColor: colors.surfaceSunken,
  },
  pillLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.8,
  },
  footnote: {
    lineHeight: 18,
  },
});
