import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planazo admin',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
