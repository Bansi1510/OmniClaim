'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Edit2, Eye, MoreVertical, Trash2, XCircle } from 'lucide-react';

/**
 * Row action menu — same behaviour as College ERP `GridActionMenu`:
 *  - wide viewport  -> inline action buttons
 *  - narrow viewport -> 3-dot trigger opening a floating portal menu (one open at a time)
 * Only actions the current role is allowed to run should be passed in (role-wise).
 */
export interface GridAction {
  key: string;
  label: string;
  title?: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'primary';
  href?: string;
}

const MENU_WIDTH = 176;
const EDGE_PADDING = 12;
const MENU_GAP = 4;
const OPEN_EVENT = 'grid-action-menu:open';

const TONE_CLASS: Record<NonNullable<GridAction['tone']>, string> = {
  default: 'text-foreground border-border hover:bg-muted',
  primary: 'text-primary border-primary/40 hover:bg-primary/10',
  success: 'text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10',
  warning: 'text-amber-500 border-amber-500/40 hover:bg-amber-500/10',
  danger: 'text-rose-500 border-rose-500/40 hover:bg-rose-500/10',
};

const TEXT_TONE: Record<NonNullable<GridAction['tone']>, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-rose-500',
};

function defaultIcon(action: GridAction) {
  if (action.icon) return action.icon;
  const key = (action.key || action.label).toLowerCase();
  if (key.includes('delete') || key.includes('remove')) return Trash2;
  if (key.includes('edit')) return Edit2;
  if (key.includes('view') || key.includes('diff') || key.includes('open')) return Eye;
  if (key.includes('approve')) return CheckCircle2;
  if (key.includes('reject')) return XCircle;
  return null;
}

function defaultTone(action: GridAction): NonNullable<GridAction['tone']> {
  if (action.tone) return action.tone;
  const key = (action.key || action.label).toLowerCase();
  if (key.includes('delete') || key.includes('remove') || key.includes('reject')) return 'danger';
  if (key.includes('approve')) return 'success';
  return 'default';
}

export function GridActionMenu({
  actions,
  inlineBreakpoint = 1100,
  triggerTitle = 'Actions',
}: {
  actions: Array<GridAction | null | false | undefined>;
  inlineBreakpoint?: number | null;
  triggerTitle?: string;
}) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );

  const visible = actions.filter((a): a is GridAction => Boolean(a) && typeof (a as GridAction).onClick === 'function');
  const inline = inlineBreakpoint !== null && viewportWidth > inlineBreakpoint;

  useEffect(() => {
    if (inlineBreakpoint === null) return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inlineBreakpoint]);

  useEffect(() => {
    if (inline) setPos(null);
  }, [inline]);

  useEffect(() => {
    if (!pos) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-grid-action-trigger="true"]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) setPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent).detail?.menuId !== menuId) setPos(null);
    };
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen);
  }, [menuId]);

  if (visible.length === 0) return <span className="text-[10px] text-muted-foreground italic">No access</span>;

  if (inline) {
    return (
      <div className="inline-flex items-center flex-nowrap gap-1.5">
        {visible.map((action) => {
          const Icon = defaultIcon(action);
          const tone = defaultTone(action);
          return (
            <button
              key={action.key}
              type="button"
              title={action.title || action.label}
              onClick={action.onClick}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-[11px] font-semibold transition ${TONE_CLASS[tone]}`}
            >
              {Icon ? <Icon className="h-3 w-3" size={12} /> : null}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const preferred = rect.right + MENU_GAP;
    const fallback = rect.left - MENU_WIDTH - MENU_GAP;
    const maxLeft = window.innerWidth - MENU_WIDTH - EDGE_PADDING;
    const next = {
      top: Math.max(EDGE_PADDING, rect.top - 2),
      left: preferred <= maxLeft ? preferred : Math.max(EDGE_PADDING, fallback),
    };
    setPos((prev) => {
      if (prev) return null;
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { menuId } }));
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        data-grid-action-trigger="true"
        title={triggerTitle}
        onClick={toggle}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {pos
        ? createPortal(
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 2000 }}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            >
              {visible.map((action) => {
                const Icon = defaultIcon(action);
                const tone = defaultTone(action);
                return (
                  <button
                    key={action.key}
                    type="button"
                    title={action.title || action.label}
                    onClick={() => {
                      setPos(null);
                      action.onClick();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${TEXT_TONE[tone]}`}
                  >
                    {Icon ? <Icon className="h-4 w-4" size={16} /> : null}
                    {action.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
