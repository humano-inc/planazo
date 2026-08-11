import type { ReportSubject } from './moderation';

/**
 * What the report sheet is pointed at, worked out from its route params
 * (Guideline 1.2). Lifted out of the screen by PLA-108: this is a sixteen-case
 * matrix of deep-link shapes, and reaching it only by rendering the sheet made
 * most of those cases unreachable in a test.
 *
 * Every branch here is a decision about someone reporting under duress, which
 * is the argument for pinning them:
 *
 * - **The dismiss target.** A cold deep link has nothing behind this sheet, so
 *   leaving falls back to the thing being reported. A profile or a photo has
 *   no route of its own, and the feed is the honest answer for both.
 * - **The self-block guard.** Reporting your own plan by accident is a real
 *   thing people do, and offering to block yourself in that moment is
 *   nonsense. `personId` goes null rather than the toggle being hidden
 *   downstream, so there is one place the rule lives.
 */
export interface ReportParams {
  type?: ReportSubject;
  id?: string;
  personId?: string;
  personName?: string;
}

export interface ReportTargets {
  subjectType: ReportSubject;
  subjectId: string;
  /** Where Cancel and a finished report land. */
  dismissTo: string;
  /** The person the block toggle would act on, or null when there is none. */
  personId: string | null;
  personName: string;
}

export function reportTargets(
  params: ReportParams,
  userId: string | null | undefined
): ReportTargets {
  const subjectType: ReportSubject = params.type ?? 'plan';
  const subjectId = params.id ?? '';
  const hasOwnRoute = subjectType === 'plan' || subjectType === 'group';

  return {
    subjectType,
    subjectId,
    dismissTo: subjectId && hasOwnRoute ? `/(app)/${subjectType}/${subjectId}` : '/(app)/(tabs)',
    personId: params.personId && params.personId !== userId ? params.personId : null,
    personName: params.personName?.trim() || 'this person',
  };
}

/** A report needs a reason, something to be about, and someone to file it. */
export function reportValid(
  targets: Pick<ReportTargets, 'subjectId'>,
  reason: string | null,
  userId: string | null | undefined
): boolean {
  return !!reason && !!targets.subjectId && !!userId;
}
