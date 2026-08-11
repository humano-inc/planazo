import * as SecureStore from 'expo-secure-store';

/**
 * Whether this person has already been shown that member rows swipe.
 *
 * The member list nudges its first row open and shut once, to say the gesture
 * exists. That is a first-run affordance, and it used to run on every mount:
 * open the group, watch the row twitch, every single time. Replayed forever it
 * stops being a demonstration and becomes something that flinches at you, and
 * it fights anyone who arrived already reaching for the row.
 *
 * The keychain is a slightly odd home for something this cosmetic, and it is
 * the honest one here: `expo-secure-store` is already a dependency and already
 * in the native build, and the alternative — a column on `profiles`, the way
 * onboarding records itself — is a migration and a round trip for a 34pt
 * animation. Being device-local is right for this: the hint teaches a gesture,
 * and a gesture is learned on the phone it was learned on.
 */
const SEEN_KEY = 'planazo.hint.member-swipe.seen';

/**
 * Latches for the rest of the launch the moment we know the answer.
 *
 * It covers two cases the stored flag cannot. A write that fails would
 * otherwise leave the hint firing on every mount for the whole session, which
 * is the exact bug this replaces. And the group list mounts this repeatedly,
 * so it saves a keychain read per visit once the answer is settled.
 */
let seenThisSession = false;

/**
 * Never nag. Both failure paths answer "already seen", because being unable to
 * tell is not a reason to show somebody a demo they may have watched a hundred
 * times. The static caption under the list still explains the swipe.
 */
export async function shouldPeekSwipeHint(): Promise<boolean> {
  if (seenThisSession) return false;
  try {
    const seen = await SecureStore.getItemAsync(SEEN_KEY);
    if (seen) {
      seenThisSession = true;
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Could not read whether the swipe hint has been seen.', error);
    seenThisSession = true;
    return false;
  }
}

/**
 * The session latch is set before the write, not after it. Somebody watching
 * the row nudge itself right now has been shown the hint whether or not the
 * keychain agrees, and the failure worth guarding against is the one where a
 * broken write means they are shown it again immediately.
 */
export async function markSwipeHintSeen(): Promise<void> {
  seenThisSession = true;
  try {
    await SecureStore.setItemAsync(SEEN_KEY, '1');
  } catch (error) {
    console.warn('Could not record that the swipe hint was seen.', error);
  }
}
