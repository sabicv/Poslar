import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Toaster } from 'sonner';
import { ServiceWorker } from '@/components/ServiceWorker';
import { accentStyle, resolvePackageFromHost } from '@/config/tenant.config';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const pkg = resolvePackageFromHost((await headers()).get('host'));
  return {
    title: { default: pkg.product, template: `%s · ${pkg.product}` },
    description: pkg.tagline,
    applicationName: pkg.product,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: pkg.product, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    icons: { icon: `/icons/${pkg.id}-192.png`, apple: `/icons/${pkg.id}-180.png` },
  };
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Applied before first paint so a light-theme user never sees a dark flash.
const THEME_SCRIPT = `try{if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pkg = resolvePackageFromHost((await headers()).get('host'));
  return (
    <html lang="hr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="accent-scope min-h-dvh font-sans" style={accentStyle(pkg)}>
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton />
        <ServiceWorker />
      </body>
    </html>
  );
}
