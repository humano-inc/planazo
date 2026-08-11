import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/auth';

import { LoginForm } from './LoginForm';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const access = await getAdminAccess();

  if (access.state === 'allowed') {
    redirect('/admin/feedback');
  }

  if (access.state === 'forbidden') {
    redirect('/admin/unauthorized');
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginWelcome} aria-label="Planazo admin">
        <a className={styles.loginBrand} href="/">
          Planazo
        </a>
        <div className={styles.loginWelcomeCopy}>
          <span className={styles.privateMark}>Private workspace</span>
          <h1>A quiet place to listen.</h1>
          <p>Review what people send before it becomes product work.</p>
        </div>
        <p className={styles.loginFootnote}>Feedback inbox</p>
      </section>

      <section className={styles.loginPanel}>
        <div className={styles.loginPanelInner}>
          <p className={styles.loginKicker}>Owner access</p>
          <h2>Sign in to Planazo</h2>
          <p className={styles.loginIntro}>
            Use the same account you use in the app. Access is checked again after sign-in.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
