import { ReactNode } from 'react';

export const metadata = {
  title: 'Developer Portal — DSF Gateway',
  robots: 'noindex, nofollow', // Prevent indexing of dev pages
};

export default function DevLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
