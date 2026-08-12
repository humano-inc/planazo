import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keyFactory } from './queryKey';
import { useAuthStore } from '../stores/authStore';

export interface Friend {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

/**
 * The person on each end of a friendship. Declared rather than inferred:
 * `friendships` holds two foreign keys into `profiles`, so the generated
 * types call the embed ambiguous and ask for a constraint hint. PostgREST
 * resolves the `alias:column(...)` form the select below uses, which is why
 * the query works; only the inference cannot follow it.
 */
interface FriendshipEnds {
  requester_id: string;
  addressee_id: string;
  requester: { id: string; display_name: string; handle: string | null; avatar_url: string | null };
  addressee: { id: string; display_name: string; handle: string | null; avatar_url: string | null };
}

/**
 * Who you are friends with. Called with no id it is the prefix a write to any
 * friendship invalidates.
 */
export const friendsKey = keyFactory('friends');

/** Accepted friendships, either direction, as the people on the other end. */
export function useFriends() {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: friendsKey(user?.id),
    queryFn: async (): Promise<Friend[]> => {
      const { data, error } = await supabase
        .from('friendships')
        .select(
          `requester_id, addressee_id,
          requester:requester_id(id, display_name, handle, avatar_url),
          addressee:addressee_id(id, display_name, handle, avatar_url)`
        )
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user?.id},addressee_id.eq.${user?.id}`);
      if (error) throw error;

      return (data as unknown as FriendshipEnds[])
        .map((f) => (f.requester_id === user?.id ? f.addressee : f.requester))
        .map((p) => ({
          id: p.id,
          name: p.display_name,
          handle: p.handle,
          avatarUrl: p.avatar_url,
        }))
        .sort((a: Friend, b: Friend) => a.name.localeCompare(b.name));
    },
    enabled: !!user,
  });

  return { ...query, friends: query.data ?? [] };
}
