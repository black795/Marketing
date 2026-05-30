import type { Metadata } from 'next';
import './globals.css';
import SandboxBadge from '@/components/SandboxBadge';

export const metadata: Metadata = {
  title: 'Tim Koda Creative OS',
  description: 'AI-powered creative production system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <SandboxBadge />
      </body>
    </html>
  );
}
