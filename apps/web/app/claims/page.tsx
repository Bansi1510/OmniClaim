'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CLAIM_STATUS_THEME, FRAUD_RISK_THEME } from '@/lib/theme-constants';
import { ClaimStatus, FraudRiskTier } from '@omniclaim/shared-types';
import { Can } from '@/components/auth/can';
import { useDynamicStore, DynamicClaim } from '@/hooks/use-dynamic-store';
import { Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

export default function ClaimsQueuePage() {
  const { claims, policies, users, addClaim, updateClaim, deleteClaim } = useDynamicStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);

  // Add / Edit Claim Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<DynamicClaim | null>(null);
  const [policyNumber, setPolicyNumber] = useState(policies[0]?.policyNumber || 'POL-OMNI-2026-9081');
  const [vehicle, setVehicle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('TRIAGE_PENDING');
  const [netPayout, setNetPayout] = useState('650');
  const [fraudScore, setFraudScore] = useState('12');
  const [adjuster, setAdjuster] = useState('Sarah Jenkins');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingClaim(null);
    const defaultPol = policies[0];
    setPolicyNumber(defaultPol?.policyNumber || 'POL-OMNI-2026-9081');
    setVehicle(
      defaultPol
        ? `${defaultPol.vehicleYear} ${defaultPol.vehicleMake} ${defaultPol.vehicleModel} (VIN: ${defaultPol.vehicleVin})`
        : '2024 Honda Civic Sedan'
    );
    setIncidentDesc('');
    setStatus('TRIAGE_PENDING');
    setNetPayout('650');
    setFraudScore('12');
    setAdjuster('Sarah Jenkins');
    setShowModal(true);
  };

  const openEdit = (claim: DynamicClaim) => {
    setEditingClaim(claim);
    setPolicyNumber(claim.policyNumber);
    setVehicle(claim.vehicle);
    setIncidentDesc(claim.incidentDescription);
    setStatus(claim.status);
    setNetPayout(String(claim.netPayout));
    setFraudScore(String(claim.fraudScore));
    setAdjuster(claim.adjuster);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const score = Math.min(100, Math.max(0, Number(fraudScore) || 0));
    const tier: FraudRiskTier =
      score >= 70 ? 'CRITICAL' : score >= 45 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';

    if (editingClaim) {
      updateClaim(editingClaim.id, {
        policyNumber,
        vehicle,
        incidentDescription: incidentDesc,
        status,
        netPayout: Number(netPayout) || 0,
        fraudScore: score,
        riskTier: tier,
        adjuster,
      });
      notify(`Claim ${editingClaim.claimNumber} updated.`);
    } else {
      const claimNumber = `CLM-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      addClaim({
        claimNumber,
        policyNumber,
        vehicle,
        incidentDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        incidentDescription: incidentDesc || 'New accident claim submitted dynamically.',
        status,
        fraudScore: score,
        riskTier: tier,
        netPayout: Number(netPayout) || 0,
        deductible: 500,
        adjuster,
        damages: [],
        reconciliationItems: [],
        fraudIndicators: [],
      });
      notify(`New claim ${claimNumber} created.`);
    }
    setShowModal(false);
  };

  const handleDelete = (claim: DynamicClaim) => {
    if (confirm(`Delete claim ${claim.claimNumber}? This action cannot be undone.`)) {
      deleteClaim(claim.id);
      notify(`Claim ${claim.claimNumber} deleted.`);
    }
  };

  const filteredClaims = claims.filter((c) => {
    const matchesSearch =
      c.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.policyNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Adjuster Triage Queue</h1>
          <p className="text-xs text-muted-foreground">
            Real-time multi-modal claim verification, dynamic CRUD, phantom diffing &amp; risk auditing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {toast && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-500 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{toast}</span>
            </div>
          )}

          <input
            type="text"
            placeholder="Search by Claim #, Policy, or VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-64 shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="TRIAGE_PENDING">Triage Pending</option>
            <option value="MANUAL_REVIEW">Manual Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SETTLED">Settled</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <Can permission="claims:create">
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-semibold shadow transition whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Submit Claim</span>
            </button>
          </Can>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Claim Dossier</th>
              <th className="py-3 px-4">Insured Vehicle &amp; Policy</th>
              <th className="py-3 px-4">Lifecycle Status</th>
              <th className="py-3 px-4">Fraud Risk Score</th>
              <th className="py-3 px-4">Net Authorized Payout</th>
              <th className="py-3 px-4">Assigned Adjuster</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredClaims.map((claim) => {
              const statusTheme = CLAIM_STATUS_THEME[claim.status];
              const riskTheme = FRAUD_RISK_THEME[claim.riskTier];

              return (
                <tr key={claim.id} className="hover:bg-muted/30 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-foreground font-mono">{claim.claimNumber}</span>
                    <span className="text-[11px] text-muted-foreground block">{claim.incidentDate}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-foreground">{claim.vehicle}</span>
                    <span className="text-[11px] font-mono text-muted-foreground block">{claim.policyNumber}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusTheme.badgeClass}`}>
                      {statusTheme.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{claim.fraudScore}/100</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${riskTheme.badgeClass}`}>
                        {riskTheme.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                    ${claim.netPayout.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {claim.adjuster}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/claims/${claim.id}`}
                        className="inline-flex items-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold transition"
                      >
                        Workspace →
                      </Link>
                      <Can permission="claims:update">
                        <button
                          onClick={() => openEdit(claim)}
                          className="rounded bg-muted hover:bg-muted/80 p-1.5 text-foreground"
                          title="Edit Claim"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </Can>
                      <Can permission="claims:delete">
                        <button
                          onClick={() => handleDelete(claim)}
                          className="rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 p-1.5"
                          title="Delete Claim"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dynamic Add / Edit Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1">
              {editingClaim ? `Edit Claim ${editingClaim.claimNumber}` : 'Initiate New Auto Insurance Claim'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              All modifications take effect immediately across workspace, ledger, and audit engines.
            </p>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Policy Number</label>
                  <select
                    value={policyNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPolicyNumber(val);
                      const pol = policies.find((p) => p.policyNumber === val);
                      if (pol) {
                        setVehicle(`${pol.vehicleYear} ${pol.vehicleMake} ${pol.vehicleModel} (VIN: ${pol.vehicleVin})`);
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                  >
                    {policies.map((p) => (
                      <option key={p.id} value={p.policyNumber}>{p.policyNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Lifecycle Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClaimStatus)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="TRIAGE_PENDING">TRIAGE_PENDING</option>
                    <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="SETTLED">SETTLED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Vehicle Description &amp; VIN</label>
                <input
                  required
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Net Payout ($)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={netPayout}
                    onChange={(e) => setNetPayout(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fraud Score (0-100)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    value={fraudScore}
                    onChange={(e) => setFraudScore(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Assigned Adjuster</label>
                  <select
                    value={adjuster}
                    onChange={(e) => setAdjuster(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
                  >
                    <option value="Autonomous STP">Autonomous STP</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.fullName}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Incident Description</label>
                <textarea
                  rows={2}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Describe collision details..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-border px-4 py-1.5 font-semibold">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">
                  {editingClaim ? 'Update Claim' : 'Create Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
