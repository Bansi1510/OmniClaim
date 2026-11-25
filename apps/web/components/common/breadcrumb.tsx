import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  title: string;
  items?: BreadcrumbItem[];
}

export function Breadcrumb({ title, items = [] }: BreadcrumbProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-5 border-b border-border/50 mb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <Link href="/claims" className="flex items-center gap-1 hover:text-foreground transition">
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground transition">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-semibold">{item.label}</span>
            )}
          </React.Fragment>
        ))}
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-primary font-semibold">{title}</span>
      </nav>
    </div>
  );
}
