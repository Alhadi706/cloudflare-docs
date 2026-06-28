import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'الميدان — أوامري',
  description: 'واجهة الموظف الميداني لأوامر العمل',
  manifest: '/manifest-mobile.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
  interactiveWidget: 'resizes-content',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-950 text-white antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
