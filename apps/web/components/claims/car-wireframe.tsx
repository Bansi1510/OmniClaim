'use client';

import React from 'react';
import { VehiclePartType } from '@omniclaim/shared-types';

interface CarWireframeProps {
  damagedParts: VehiclePartType[];
  onSelectPart?: (part: VehiclePartType) => void;
}

export function CarWireframe({ damagedParts, onSelectPart }: CarWireframeProps) {
  const damagedSet = new Set(damagedParts);

  const getPartColor = (part: VehiclePartType) => {
    return damagedSet.has(part) ? '#ef4444' : '#334155'; // Red if damaged, slate if clean
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/60 p-5 shadow-sm">
      <div className="flex w-full items-center justify-between pb-3 border-b border-border/50 text-xs text-muted-foreground font-medium">
        <span>TOP-DOWN VEHICLE DAMAGE SCHEMATIC</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Damaged</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-700" /> Intact</span>
        </div>
      </div>

      {/* Interactive Top-down 2D Car Wireframe */}
      <svg
        className="w-full max-w-[280px] h-auto my-4"
        viewBox="0 0 200 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Chassis Body Outline */}
        <rect x="35" y="40" width="130" height="320" rx="40" stroke="#475569" strokeWidth="2" fill="#0f172a" />

        {/* Front Bumper Hotspot */}
        <path
          d="M 40 40 Q 100 15 160 40"
          stroke={getPartColor('BUMPER_FRONT')}
          strokeWidth="10"
          strokeLinecap="round"
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('BUMPER_FRONT')}
        />

        {/* Rear Bumper Hotspot */}
        <path
          d="M 40 360 Q 100 385 160 360"
          stroke={getPartColor('BUMPER_REAR')}
          strokeWidth="10"
          strokeLinecap="round"
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('BUMPER_REAR')}
        />

        {/* Bonnet / Hood Hotspot */}
        <rect
          x="55"
          y="55"
          width="90"
          height="70"
          rx="10"
          fill={getPartColor('HOOD_BONNET')}
          fillOpacity={damagedSet.has('HOOD_BONNET') ? '0.7' : '0.2'}
          stroke={getPartColor('HOOD_BONNET')}
          strokeWidth="2"
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('HOOD_BONNET')}
        />

        {/* Windshield Glass Hotspot */}
        <path
          d="M 50 135 L 65 180 L 135 180 L 150 135 Z"
          fill={getPartColor('WINDSHIELD_FRONT')}
          fillOpacity={damagedSet.has('WINDSHIELD_FRONT') ? '0.7' : '0.2'}
          stroke={getPartColor('WINDSHIELD_FRONT')}
          strokeWidth="2"
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('WINDSHIELD_FRONT')}
        />

        {/* Left Front Door Hotspot */}
        <rect
          x="30"
          y="185"
          width="16"
          height="65"
          rx="4"
          fill={getPartColor('DOOR_FRONT_LEFT')}
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('DOOR_FRONT_LEFT')}
        />

        {/* Right Front Door Hotspot */}
        <rect
          x="154"
          y="185"
          width="16"
          height="65"
          rx="4"
          fill={getPartColor('DOOR_FRONT_RIGHT')}
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectPart?.('DOOR_FRONT_RIGHT')}
        />

        {/* Roof Center */}
        <rect
          x="60"
          y="190"
          width="80"
          height="90"
          rx="8"
          fill={getPartColor('ROOF')}
          fillOpacity={damagedSet.has('ROOF') ? '0.7' : '0.1'}
          stroke="#475569"
          strokeWidth="1"
        />

        {/* Rear Windshield Glass */}
        <path
          d="M 60 290 L 70 330 L 130 330 L 140 290 Z"
          fill={getPartColor('WINDSHIELD_REAR')}
          fillOpacity={damagedSet.has('WINDSHIELD_REAR') ? '0.7' : '0.2'}
          stroke={getPartColor('WINDSHIELD_REAR')}
          strokeWidth="2"
        />
      </svg>
      <span className="text-xs text-muted-foreground text-center">Interactive Schematic: Click parts to highlight in photo gallery</span>
    </div>
  );
}
