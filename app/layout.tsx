import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/constants';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Private rental property management for landlords and tenants.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
