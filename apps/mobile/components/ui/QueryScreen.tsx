import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from './ErrorState';
import { errorCopy, isNotFoundError } from '../../lib/queryErrors';
import { colors } from '../../theme/tokens';

interface QueryScreenProps {
  /** The query is in flight: the spinner wins over any stale failure. */
  isLoading: boolean;
  /**
   * There is nothing to render: the query errored, or it settled with no row.
   * Passed rather than inferred, because a screen can have a reason to hold
   * the spinner instead — plan detail waits out a redirect that way.
   */
  failed: boolean;
  /** The route param. Missing is a not-found in its own right. */
  id: string | undefined;
  error: unknown;
  /** What a missing row is called here: a group, a plan, a member list. */
  goneCopy: { title: string; body: string };
  onRetry: () => void;
  onBack: () => void;
  testID: string;
}

/**
 * What a screen renders *instead of itself* while its query is loading or has
 * failed, which four detail screens each spelled out in about 28 lines of
 * identical branch (PLA-115).
 *
 * The two states are one component because the choice between them is one
 * decision: a query in flight shows the spinner even when a previous fetch
 * failed, or a retry would flash its own error at you before it could succeed.
 *
 * Retry is offered only when retrying could work. A row that is not there —
 * deleted, or hidden by RLS, which read identically from here — never becomes
 * there by asking again, so that case gets the way out and no false hope
 * (PLA-19).
 */
export function QueryScreen({
  isLoading,
  failed,
  id,
  error,
  goneCopy,
  onRetry,
  onBack,
  testID,
}: QueryScreenProps) {
  // A settled failure, and nothing in flight to change it.
  const showError = failed && !isLoading;
  const notFound = !id || isNotFoundError(error);
  const copy = notFound ? goneCopy : errorCopy(error);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {showError ? (
        <ErrorState
          title={copy.title}
          body={copy.body}
          onRetry={notFound ? undefined : onRetry}
          onBack={onBack}
          testID={testID}
        />
      ) : (
        <View style={styles.loading} testID={`${testID}-loading`}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
