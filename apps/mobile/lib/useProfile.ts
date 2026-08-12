import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { actionErrorCopy, alertActionError, UserFacingError } from './queryErrors';
import { signOutOfAccount } from './signOut';
import { clearPushToken, registerPushToken } from './push';
import { purgeOwnedFiles } from './storage';
import { useAuthStore } from '../stores/authStore';

/**
 * Everything the profile sheet fetches or writes, including the way out to
 * login once the session is gone.
 *
 * The confirmations live in the screen, not here. This module owns what
 * happens after the user has said yes, including the dialogs that report a
 * failure and the exit that follows a success, because those belong to the
 * action rather than to the layout — the same division useCreatePlan draws.
 */
export function useProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, profile, setProfile } = useAuthStore();

  /**
   * The exit both ways out of an account share. Leaving is conditional on the
   * credentials actually being gone from the device: a login screen shown over
   * a session still on disk signs them straight back in on the next launch
   * (PLA-36), so a refusal stays put and says which of the two happened.
   */
  const leaveOrExplain = async (stuckTitle: string, stuckBody: string) => {
    if (await signOutOfAccount(user?.id, queryClient)) {
      router.replace('/(auth)/login');
      return;
    }
    Alert.alert(stuckTitle, stuckBody);
  };

  const { data: groupCount } = useQuery({
    queryKey: ['profile-group-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('group_members')
        .select('group_id', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const setCalendar = useMutation({
    mutationFn: async (on: boolean) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ add_to_calendar: on })
        .eq('id', profile!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => setProfile(data),
    onError: alertActionError,
  });

  const setPush = useMutation({
    mutationFn: async (on: boolean) => {
      // The privacy policy says turning notifications off clears the device
      // token, so do that rather than only flipping a flag — otherwise the
      // token sits on the profile and the policy is a lie. Token first, so
      // the row we read back already reflects it.
      if (on) {
        await registerPushToken(profile!.id);
      } else {
        await clearPushToken(profile!.id);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ push_enabled: on })
        .eq('id', profile!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => setProfile(data),
    onError: alertActionError,
  });

  const signOut = useMutation({
    mutationFn: () =>
      leaveOrExplain(
        "Couldn't sign out",
        'Your account is still signed in on this device. Check your connection and try again.'
      ),
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      // Files first, while this session is still the owner RLS recognises.
      // The database cannot reach Storage, so if this does not happen here it
      // does not happen at all — and the avatars bucket is public.
      if (user) {
        const { failed } = await purgeOwnedFiles(user.id);
        // Stop rather than delete around it. Once the account is gone nobody
        // can sign in as this user again, so a file left behind is left for
        // good — a public avatar URL that outlives the account it belonged to.
        // Better to fail loudly and let them try again in a moment.
        if (failed.length) {
          throw new UserFacingError(
            "Your photos couldn't be removed just now, and deleting the account would leave them online for good. Check your connection and try again.",
          );
        }
      }

      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
    },
    // The account is already gone, so the token this session holds is dead. It
    // still has to leave the device: supabase-js only clears its storage when
    // its own /logout call succeeds, and here that call is answered by a server
    // with no such user — so without this the next launch would restore a
    // session for a deleted account (PLA-36).
    onSuccess: () =>
      leaveOrExplain(
        'Your account is deleted',
        "It couldn't be signed out on this device. Check your connection and sign out from this screen."
      ),
    // Same shape as report.tsx: the title names this irreversible action, the
    // body comes classified rather than raw.
    onError: (error: unknown) =>
      Alert.alert("Couldn't delete your account", actionErrorCopy(error).body),
  });

  return { profile, groupCount, setCalendar, setPush, signOut, deleteAccount };
}
