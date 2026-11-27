import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ALS IV · Stellar Atlas',
  description: 'Interactive 3D atlas of the ALS IV catalogue.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
