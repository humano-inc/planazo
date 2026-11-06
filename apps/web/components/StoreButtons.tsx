import Image from 'next/image';

import { LANG, STORES } from '@/lib/copy';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/links';
import styles from './StoreButtons.module.css';

const copy = STORES[LANG];

/**
 * The two ways to get the app, straight to each store with nothing in between.
 *
 * These are each store's official badges, used unmodified as their guidelines
 * ask. Apple's comes first because its guidelines ask for that too.
 */
export default function StoreButtons() {
  return (
    <div className={styles.badges}>
      <a className={styles.badge} href={APP_STORE_URL}>
        <Image
          className={styles.appStore}
          src={`/badges/app-store-${LANG}.svg`}
          alt={copy.appStore}
          width={120}
          height={40}
          unoptimized
        />
      </a>
      <a className={styles.badge} href={PLAY_STORE_URL}>
        <Image
          className={styles.googlePlay}
          src={`/badges/google-play-${LANG}.png`}
          alt={copy.googlePlay}
          width={646}
          height={250}
          unoptimized
        />
      </a>
    </div>
  );
}
