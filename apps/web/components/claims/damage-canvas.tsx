'use client';

import React, { useState } from 'react';
import { BoundingBox, DetectedDamageDto } from '@omniclaim/shared-types';
import { DAMAGE_SEVERITY_COLORS } from '@/lib/theme-constants';

interface DamageCanvasProps {
  imageUrl: string;
  damages: DetectedDamageDto[];
  onAddDamage?: (newBox: BoundingBox, partType: string) => void;
  onSelectDamage?: (damageId: string) => void;
}

export function DamageCanvas({
  imageUrl,
  damages,
  onSelectDamage,
}: DamageCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleBoxClick = (id: string) => {
    setSelectedId(id);
    onSelectDamage?.(id);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black/60 shadow-inner group">
      {/* Background Vehicle Damage Image */}
      <img
        src={imageUrl}
        alt="Vehicle Damage Scene"
        className="h-auto w-full max-h-[500px] object-contain select-none"
      />

      {/* Interactive Normalized SVG Bounding Box Overlay */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-auto"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        {damages.map((dmg) => {
          const { xmin, ymin, xmax, ymax } = dmg.boundingBox;
          const x = xmin * 1000;
          const y = ymin * 1000;
          const width = (xmax - xmin) * 1000;
          const height = (ymax - ymin) * 1000;

          const colorTheme = DAMAGE_SEVERITY_COLORS[dmg.severity] || {
            stroke: '#06b6d4',
            fill: 'rgba(6, 182, 212, 0.25)',
          };

          const isSelected = selectedId === dmg.id;

          return (
            <g
              key={dmg.id}
              onClick={() => handleBoxClick(dmg.id)}
              className="cursor-pointer transition-all hover:opacity-100"
            >
              {/* Bounding Box Rect */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={colorTheme.fill}
                stroke={colorTheme.stroke}
                strokeWidth={isSelected ? 5 : 3}
                strokeDasharray={isSelected ? '6 3' : 'none'}
                rx="4"
              />

              {/* Header Label Badge */}
              <rect
                x={x}
                y={Math.max(0, y - 28)}
                width={Math.max(160, width * 0.6)}
                height="26"
                fill={colorTheme.stroke}
                rx="3"
              />
              <text
                x={x + 6}
                y={Math.max(0, y - 28) + 18}
                fill="#ffffff"
                fontSize="14"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {dmg.partType} ({Math.round(dmg.confidence * 100)}%)
              </text>
            </g>
          );
        })}
      </svg>

      {/* Canvas Tooling Overlay Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-background/90 px-4 py-2 text-xs backdrop-blur border border-border shadow">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-foreground">Detected Parts ({damages.length}):</span>
          <div className="flex items-center gap-3">
            {damages.map((d) => (
              <span
                key={d.id}
                onClick={() => handleBoxClick(d.id)}
                className={`cursor-pointer rounded px-2 py-0.5 font-medium transition ${
                  selectedId === d.id ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                }`}
              >
                {d.partType}
              </span>
            ))}
          </div>
        </div>
        <span className="text-muted-foreground">Click bounding box to focus</span>
      </div>
    </div>
  );
}
