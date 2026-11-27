import { ClaimStatus, DamageSeverity, FraudRiskTier } from '@omniclaim/shared-types';

/**
 * Claim Status Theme Map for badges, borders, and indicators
 */
export const CLAIM_STATUS_THEME: Record<
  ClaimStatus,
  { label: string; badgeClass: string; borderClass: string; icon: string }
> = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
    borderClass: 'border-slate-500',
    icon: 'FileEdit',
  },
  SUBMITTED: {
    label: 'Submitted',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    borderClass: 'border-blue-500',
    icon: 'Send',
  },
  AI_PROCESSING: {
    label: 'AI Inspecting',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 animate-pulse',
    borderClass: 'border-indigo-500',
    icon: 'Cpu',
  },
  AI_ANALYSIS_FAILED: {
    label: 'AI Error',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    borderClass: 'border-red-500',
    icon: 'AlertTriangle',
  },
  TRIAGE_PENDING: {
    label: 'Triage Pending',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    borderClass: 'border-amber-500',
    icon: 'Clock',
  },
  MANUAL_REVIEW: {
    label: 'Manual Review',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    borderClass: 'border-orange-500',
    icon: 'UserCheck',
  },
  APPROVED: {
    label: 'Approved',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    borderClass: 'border-teal-500',
    icon: 'CheckCircle2',
  },
  PAYMENT_PENDING: {
    label: 'Payment Pending',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    borderClass: 'border-sky-500',
    icon: 'Clock',
  },
  PAYMENT_FAILED: {
    label: 'Payment Failed',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    borderClass: 'border-red-500',
    icon: 'AlertTriangle',
  },
  SETTLED: {
    label: 'Settled & Paid',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold',
    borderClass: 'border-emerald-500',
    icon: 'BadgeCheck',
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    borderClass: 'border-rose-500',
    icon: 'XCircle',
  },
  DISPUTED: {
    label: 'Disputed',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    borderClass: 'border-purple-500',
    icon: 'AlertTriangle',
  },
  REOPENED: {
    label: 'Reopened',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    borderClass: 'border-amber-500',
    icon: 'RefreshCw',
  },
};

/**
 * Visual Canvas Bounding Box Color Tokens
 */
export const DAMAGE_SEVERITY_COLORS: Record<
  DamageSeverity,
  { stroke: string; fill: string; label: string }
> = {
  SCRATCH: {
    stroke: '#06b6d4', // Cyan 500
    fill: 'rgba(6, 182, 212, 0.25)',
    label: 'Scratch / Surface Scuff',
  },
  DENT: {
    stroke: '#f59e0b', // Amber 500
    fill: 'rgba(245, 158, 11, 0.25)',
    label: 'Body Panel Dent',
  },
  TEAR_PUNCTURE: {
    stroke: '#f97316', // Orange 500
    fill: 'rgba(249, 115, 22, 0.30)',
    label: 'Tear / Puncture',
  },
  SHATTERED: {
    stroke: '#ef4444', // Red 500
    fill: 'rgba(239, 68, 68, 0.35)',
    label: 'Shattered Glass / Totaled',
  },
  STRUCTURAL_TOTAL: {
    stroke: '#dc2626', // Red 600
    fill: 'rgba(220, 38, 38, 0.40)',
    label: 'Structural / Chassis Deformation',
  },
};

/**
 * Fraud Risk Tier Styling
 */
export const FRAUD_RISK_THEME: Record<
  FraudRiskTier,
  { label: string; badgeClass: string; bgClass: string }
> = {
  LOW: {
    label: 'Low Risk (Clean)',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    bgClass: 'bg-emerald-500',
  },
  MEDIUM: {
    label: 'Medium Risk',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    bgClass: 'bg-amber-500',
  },
  HIGH: {
    label: 'High Risk (Audit)',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    bgClass: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Critical Risk (SIU)',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold',
    bgClass: 'bg-rose-500',
  },
};
