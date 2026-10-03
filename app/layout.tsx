import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Saira_Condensed } from 'next/font/google';
import { Toaster } from 'sonner';
import { ServiceWorker } from '@/components/ServiceWorker';
import { BRAND, accentStyle, brandAccentStyle } from '@/config/tenant.config';
import { packageForRequest } from '@/lib/package-for-request';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { pkg, generic } = await packageForRequest();
  const name = generic ? BRAND.name : pkg.product;
  const icon = generic ? BRAND.id : pkg.id;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: generic ? BRAND.tagline : pkg.tagline,
    applicationName: name,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: name, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    icons: { icon: `/icons/${icon}-192.png`, apple: `/icons/${icon}-180.png` },
  };
}

// Headings in a narrow, sporty face; body text stays in Geist for reading.
const display = Saira_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['600', '700'], variable: '--font-display', display: 'swap' });

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android: the keyboard shrinks the page instead of covering it, so a
  // sheet's fields and its Spremi button stay above the keyboard.
  interactiveWidget: 'resizes-content',
};

// Applied before first paint so a light-theme user never sees a dark flash.
const THEME_SCRIPT = `try{if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { pkg, generic } = await packageForRequest();
  return (
    <html lang="hr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="accent-scope min-h-dvh font-sans" style={generic ? brandAccentStyle() : accentStyle(pkg)}>
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton />
        <ServiceWorker />
      </body>
    </html>
  );
}
