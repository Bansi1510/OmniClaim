import type { Metadata } from 'next';
import './globals.css';
import { DynamicStoreProvider } from '@/hooks/use-dynamic-store';
import { PermissionsProvider } from '@/hooks/use-permissions';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'OmniClaim | Enterprise Super Admin & Dynamic Adjuster Center',
  description: 'Automated Multi-Modal Auto Insurance Claim, Dynamic CRUD & Fraud Detection Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <DynamicStoreProvider>
          <PermissionsProvider>
            <AppShell>{children}</AppShell>
          </PermissionsProvider>
        </DynamicStoreProvider>
      </body>
    </html>
  );
}
