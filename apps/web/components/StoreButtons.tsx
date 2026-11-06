import { LANG, STORES } from '@/lib/copy';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/links';
import styles from './StoreButtons.module.css';

const copy = STORES[LANG];

/**
 * The two ways to get the app, straight to each store with nothing in between.
 * The button's look belongs to the page it sits on.
 */
export default function StoreButtons({ buttonClassName }: { buttonClassName: string }) {
  return (
    <div className={styles.buttons}>
      <a className={`${styles.button} ${buttonClassName}`} href={APP_STORE_URL}>
        {copy.appStore}
      </a>
      <a className={`${styles.button} ${buttonClassName}`} href={PLAY_STORE_URL}>
        {copy.googlePlay}
      </a>
    </div>
  );
}
