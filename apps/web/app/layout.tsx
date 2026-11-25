import type { Metadata } from 'next';
import './globals.css';

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
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <a href="/claims" className="flex items-center gap-2 font-bold tracking-tight text-lg text-primary">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow">
                  Ω
                </span>
                OmniClaim
              </a>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <a href="/claims" className="transition-colors hover:text-foreground/80 text-foreground">
                  Claims Queue
                </a>
                <a href="/admin/rbac" className="transition-colors hover:text-foreground/80 text-muted-foreground">
                  Dynamic RBAC Matrix
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Adjuster Presence
              </div>
              <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-semibold">
                AD
              </div>
            </div>
          </div>
        </header>
        <main className="container max-w-screen-2xl p-6">{children}</main>
      </body>
    </html>
  );
}
