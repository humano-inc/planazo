'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { createLinearIssueAction, reopenFeedbackAction } from './actions';
import styles from '../admin.module.css';

function ConfirmSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.dialogConfirm} disabled={pending} type="submit">
      {pending ? 'Working…' : label}
    </button>
  );
}

type ConfirmationButtonProps = {
  feedbackId: string;
  mode: 'linear' | 'reopen';
};

export function ConfirmationButton({ feedbackId, mode }: ConfirmationButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isLinear = mode === 'linear';

  return (
    <>
      <button
        className={isLinear ? styles.primaryAction : styles.secondaryAction}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {isLinear ? 'Create Linear issue' : 'Mark unresolved'}
      </button>

      <dialog className={styles.confirmDialog} ref={dialogRef}>
        <div className={styles.dialogTopline} aria-hidden="true" />
        <div className={styles.dialogBody}>
          <p className={styles.dialogKicker}>{isLinear ? 'Ready for the backlog' : 'Recovery'}</p>
          <h2>{isLinear ? 'Create this issue in Linear?' : 'Check Linear before reopening'}</h2>
          <p>
            {isLinear
              ? 'The message, device context, and screenshot will be copied. The sender’s email stays private in this inbox.'
              : 'If an issue was created before the connection stopped, creating another one would duplicate it.'}
          </p>
        </div>
        <div className={styles.dialogActions}>
          <form method="dialog">
            <button className={styles.dialogCancel} type="submit">
              Cancel
            </button>
          </form>
          <form action={isLinear ? createLinearIssueAction : reopenFeedbackAction}>
            <input name="feedbackId" type="hidden" value={feedbackId} />
            <ConfirmSubmit label={isLinear ? 'Create issue' : 'Mark unresolved anyway'} />
          </form>
        </div>
      </dialog>
    </>
  );
}
