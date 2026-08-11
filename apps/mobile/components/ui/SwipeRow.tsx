import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { resistPast, settlesOpen } from '../../lib/swipePhysics';
import { colors } from '../../theme/tokens';

export interface SwipeAction {
  /** Stable id, also the name VoiceOver's rotor reports. */
  key: string;
  label: string;
  background: string;
  foreground: string;
  icon: ReactNode;
  onPress: () => void;
  testID?: string;
}

interface SwipeRowProps {
  actions: SwipeAction[];
  /** Controlled by the list so only one row is ever open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Nudge the row open and shut once, to announce the actions exist.
   *
   * Whether this mount is the one that gets to do that is not this component's
   * business: it is a once-per-person decision that has to outlive the row,
   * and `useSwipeHint` is what owns it.
   */
  peek?: boolean;
  /** The row's whole contents. All of it slides. */
  children: ReactNode;
  testID?: string;
}

/** Each action is a 80pt column, the same square-ish block iOS Mail uses. */
export const ACTION_WIDTH = 80;
/** Below this a gesture is a tap or a scroll, not a swipe. */
const AXIS_SLOP = 10;
/**
 * A drag has to be half again more horizontal than vertical before a row will
 * take it. At parity the list would lose diagonal scrolls to whichever row the
 * thumb happened to start on, and a stolen scroll is far more annoying than a
 * swipe that needs saying twice.
 */
const AXIS_RATIO = 1.5;

/**
 * Slightly underdamped: a damping ratio near 0.9, so it arrives fast and
 * settles with a hint of overshoot rather than gliding to a stop. `velocity`
 * is what carries the finger's throw into the animation, which is the
 * difference between a row that snaps and a row that is *thrown* open.
 */
const SPRING = {
  stiffness: 340,
  damping: 34,
  mass: 1,
  useNativeDriver: true,
  restDisplacementThreshold: 0.4,
  restSpeedThreshold: 4,
} as const;

/**
 * A row that slides left to reveal actions underneath it.
 *
 * Built on PanResponder and Animated from React Native itself rather than
 * `react-native-gesture-handler`, which this app does not have: adding it is a
 * native dependency, and the `ios` folder is gitignored, so every checkout
 * would need a rebuild to open one screen. The tracking is therefore
 * JS-driven; the settle is a native-driven spring.
 *
 * Two details are load-bearing rather than decorative:
 *
 * - **Everything slides.** The avatar, the name and the admin badge all travel
 *   with the surface, because a row whose contents stay pinned while the white
 *   moves out from under them does not read as being dragged at all. This used
 *   to counter-translate the person, on the theory that the face you are about
 *   to remove should stay under your thumb; what it actually cost was every
 *   scrap of feedback the gesture had (PLA-93).
 * - **There is no full-swipe shortcut.** Dragging past the end gives, but
 *   commits nothing; removing somebody is always a deliberate second tap.
 *   Swipe-to-commit is right for archiving mail and wrong for throwing a
 *   person out of a group.
 */
export function SwipeRow({
  actions,
  open,
  onOpenChange,
  peek = false,
  children,
  testID,
}: SwipeRowProps) {
  const rest = -ACTION_WIDTH * actions.length;
  const translateX = useRef(new Animated.Value(0)).current;
  // Where the row sits when nobody is dragging it. The Animated.Value is the
  // live position; this is the one the next gesture starts from.
  const resting = useRef(0);
  // Where it *actually* is, tracked only while a spring is in flight. Grabbing
  // a settling row used to start the new drag from wherever the old animation
  // was heading, so an impatient second swipe teleported the row before moving
  // it — which is the exact moment somebody is most likely to be re-swiping.
  const live = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  // PanResponder is built once, so anything it calls has to be read through a
  // ref or it stays pinned to the first render's closure.
  const notifyRef = useRef(onOpenChange);
  notifyRef.current = onOpenChange;
  const touched = useRef(false);

  // Stable: it only touches refs, so the effects below can depend on it
  // honestly instead of omitting it and hoping.
  const springTo = useCallback(
    (to: number, velocity = 0) => {
      resting.current = to;
      // The listener is what keeps `live` honest, and it only exists for the
      // few hundred milliseconds the spring is running. A native-driven value
      // tells JS nothing about itself otherwise.
      const id = translateX.addListener(({ value }) => {
        live.current = value;
      });
      Animated.spring(translateX, { ...SPRING, toValue: to, velocity }).start(({ finished }) => {
        translateX.removeListener(id);
        // Interrupted, the row is wherever the next gesture already put it;
        // only an animation that ran its course knows it arrived.
        if (finished) live.current = to;
      });
    },
    [translateX]
  );

  // The list closed us because another row opened, or an action fired.
  useEffect(() => {
    if (!open && resting.current !== 0) springTo(0);
  }, [open, springTo]);

  useEffect(() => {
    if (!peek) return;
    // 34pt is enough to show colour and motion without reading as "open".
    // Both steps stand down the moment a real finger arrives: a demo that
    // yanks the row shut under someone mid-swipe is worse than no demo.
    const out = setTimeout(() => {
      if (!touched.current) springTo(-34);
    }, 600);
    const back = setTimeout(() => {
      if (!touched.current) springTo(0);
    }, 1450);
    return () => {
      clearTimeout(out);
      clearTimeout(back);
    };
  }, [peek, springTo]);

  const pan = useRef(
    PanResponder.create({
      // Never claim the touch on press: taps belong to whatever is inside.
      onStartShouldSetPanResponder: () => false,
      // Horizontal only, so the ScrollView keeps every vertical drag.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > AXIS_SLOP && Math.abs(g.dx) > Math.abs(g.dy) * AXIS_RATIO,
      // Whatever was in flight is over, and this drag starts from where the
      // row is now. `g.dx` counts from the touch down rather than from here,
      // so the slop that won the responder has to come back off the origin.
      onPanResponderGrant: (_e, g) => {
        touched.current = true;
        translateX.stopAnimation();
        resting.current = live.current - g.dx;
      },
      onPanResponderMove: (_e, g) => {
        translateX.setValue(resistPast(resting.current + g.dx, rest));
      },
      onPanResponderRelease: (_e, g) => {
        const landed = resistPast(resting.current + g.dx, rest);
        const shouldOpen = settlesOpen(landed, g.vx, rest);
        // `vx` is points per millisecond and Animated wants points per second,
        // so the throw arrives at the right scale rather than as a rounding
        // error on the spring.
        springTo(shouldOpen ? rest : 0, g.vx * 1000);
        if (shouldOpen !== openRef.current) {
          if (shouldOpen) Haptics.selectionAsync().catch(() => {});
          notifyRef.current(shouldOpen);
        }
      },
      onPanResponderTerminate: () => {
        springTo(openRef.current ? rest : 0);
      },
    })
  ).current;

  return (
    <View style={styles.clip} testID={testID}>
      <View
        style={styles.actions}
        // Closed, the buttons are behind an opaque row; letting VoiceOver walk
        // into them would be walking into something nobody can see. The row
        // itself carries the same actions as accessibilityActions instead.
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
      >
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={action.testID}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: action.background },
              pressed && styles.actionPressed,
            ]}
          >
            {action.icon}
            <ThemedText variant="tag" color={action.foreground}>
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
        testID={testID ? `${testID}-row` : undefined}
        accessible
        accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
        onAccessibilityAction={(event) => {
          const match = actions.find((a) => a.key === event.nativeEvent.actionName);
          match?.onPress();
        }}
      >
        <View style={styles.body}>{children}</View>
        <ThemedText variant="body" color={colors.textFaint} style={styles.hint}>
          ‹
        </ThemedText>

        {/* Open, a tap on the person shuts the row rather than hitting what is
            under it.

            It lives inside the sliding layer on purpose. As a sibling of it,
            an absolutely-filled scrim would also cover the two action buttons
            it has just revealed, and every tap on Remove would land here
            instead. Riding with the content, it covers exactly the part of the
            row still showing the person. */}
        {open ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => onOpenChange(false)}
            accessibilityRole="button"
            accessibilityLabel="Close actions"
            testID={testID ? `${testID}-scrim` : undefined}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    position: 'relative',
  },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionPressed: {
    opacity: 0.85,
  },
  content: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The row's contents get the whole width the chevron does not want, so a
  // caller only has to describe a person and never where the chevron goes.
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  hint: {
    paddingRight: 16,
  },
});
