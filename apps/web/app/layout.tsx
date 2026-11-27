import type { Metadata } from 'next';
import './globals.css';
import { DynamicStoreProvider } from '@/hooks/use-dynamic-store';
import { PermissionsProvider } from '@/hooks/use-permissions';
import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: 'OmniClaim | Insurance Policies & Claims Portal',
  description: 'Simple, transparent insurance policy applications, underwriting, and claims management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
