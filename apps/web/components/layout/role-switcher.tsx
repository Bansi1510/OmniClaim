'use client';

import React from 'react';
import { usePermissions, ROLE_PRESETS } from '@/hooks/use-permissions';
import { Shield } from 'lucide-react';

export function RoleSwitcher() {
  const { activeRole, switchRole, isLoading } = usePermissions();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
        <Shield className="h-3.5 w-3.5" />
        <select
          value={activeRole}
          disabled={isLoading}
          onChange={(e) => switchRole(e.target.value)}
          className="bg-transparent text-primary font-semibold focus:outline-none cursor-pointer text-xs"
        >
          {Object.entries(ROLE_PRESETS).map(([key, role]) => (
            <option key={key} value={key} className="bg-card text-foreground">
              Role: {role.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
