import type { Metadata } from 'next';

import LegalPage from '@/components/LegalPage';
import { LANG } from '@/lib/copy';
import { DELETE_ACCOUNT, PRIVACY } from '@/lib/legal';

const doc = DELETE_ACCOUNT[LANG];

export const metadata: Metadata = {
  title: `${doc.title} · Planazo`,
  description: doc.lede,
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title={doc.title}
      lede={doc.lede}
      updatedLabel={doc.updatedLabel}
      backHome={doc.backHome}
      sections={doc.sections}
      sibling={{ href: '/privacy', label: PRIVACY[LANG].title }}
    />
  );
}
