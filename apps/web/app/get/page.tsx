import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GET, LANG } from '@/lib/copy';
import { APP_STORE_URL, PLAY_STORE_URL, storeForUserAgent, type Store } from '@/lib/links';
import styles from '../applink.module.css';

const copy = GET[LANG];

const STORE_URLS: Record<Store, string> = {
  'app-store': APP_STORE_URL,
  'google-play': PLAY_STORE_URL,
};

export const metadata: Metadata = {
  title: `${copy.metaTitle} · Planazo`,
  description: copy.metaDescription,
  // A redirect for nearly everyone who reaches it, so not a page worth indexing.
  robots: { index: false, follow: false },
};

/**
 * Where every "get the app" button goes.
 *
 * A phone goes straight to its own store, with nothing to read and no extra tap.
 * Only a browser that cannot install anything sees the two buttons.
 */
export default async function GetPage() {
  const store = storeForUserAgent((await headers()).get('user-agent'));
  if (store) redirect(STORE_URLS[store]);

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={`serif ${styles.wordmark}`}>
          Planazo
        </Link>
        <Link href="/" className={styles.navBack}>
          {copy.backHome}
        </Link>
      </nav>

      <h1 className={`serif ${styles.title}`}>{copy.title}</h1>
      <p className={styles.lede}>{copy.lede}</p>

      <div className={styles.ctaBlock}>
        <a className={styles.btnInk} href={APP_STORE_URL}>
          {copy.appStore}
        </a>
        <a className={styles.btnInk} href={PLAY_STORE_URL}>
          {copy.googlePlay}
        </a>
      </div>
    </main>
  );
}
