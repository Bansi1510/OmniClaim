import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { RoleSwitcher } from '@/components/layout/role-switcher';
import { PermissionsProvider } from '@/hooks/use-permissions';

export const metadata: Metadata = {
  title: 'OmniClaim | Enterprise Adjuster Command Center',
  description: 'Automated Multi-Modal Auto Insurance Claim & Fraud Detection Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <PermissionsProvider>
          {/* Top Master Header Navbar */}
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 w-full items-center justify-between px-6">
              <div className="flex items-center gap-6">
                <Link href="/claims" className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-primary">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm shadow">
                    Ω
                  </span>
                  OmniClaim
                </Link>
                <span className="text-xs text-muted-foreground border-l border-border/60 pl-4 hidden sm:inline">
                  Enterprise Fraud & Settlement Engine
                </span>
              </div>

              {/* Top Bar Actions with Live Role Switcher */}
              <div className="flex items-center gap-4">
                <RoleSwitcher />

                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Presence
                </div>

                <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-semibold text-primary">
                  AD
                </div>
              </div>
            </div>
          </header>

          {/* Main Application Frame with Dynamic Navigation Sidebar */}
          <div className="flex w-full">
            <Sidebar />
            <main className="flex-1 p-6 max-w-full overflow-x-hidden">{children}</main>
          </div>
        </PermissionsProvider>
      </body>
    </html>
  );
}
