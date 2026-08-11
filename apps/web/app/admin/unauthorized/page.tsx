import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/auth';

import { signOutAction } from '../actions';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function UnauthorizedPage() {
  const access = await getAdminAccess();

  if (access.state === 'signed-out') {
    redirect('/admin/login');
  }

  if (access.state === 'allowed') {
    redirect('/admin/feedback');
  }

  return (
    <main className={styles.deniedPage}>
      <div className={styles.deniedPanel}>
        <a className={styles.deniedBrand} href="/">
          Planazo
        </a>
        <p className={styles.loginKicker}>Private workspace</p>
        <h1>This account is not an admin.</h1>
        <p>
          You are signed in as <strong>{access.email ?? 'an unknown account'}</strong>.
        </p>
        <form action={signOutAction}>
          <button className={styles.primaryButton} type="submit">
            Sign out and try again
          </button>
        </form>
      </div>
    </main>
  );
}
