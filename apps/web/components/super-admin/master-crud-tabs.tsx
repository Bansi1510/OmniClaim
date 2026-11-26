'use client';

import React, { useState } from 'react';
import { useDynamicStore } from '@/hooks/use-dynamic-store';
import {
  PolicyMasterDto,
  VehiclePartCatalogDto,
  DepreciationRuleDto,
  AutomationRuleDto,
  RepairGarageDto,
  DynamicMenuItemDto,
  VehiclePartType,
  MaterialType,
  AutomationRuleType,
} from '@omniclaim/shared-types';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckCircle2,
  Ban,
  Star,
} from 'lucide-react';

interface NotifyProp {
  onNotify: (msg: string) => void;
}

// =========================================================================
// TAB 3: DYNAMIC POLICIES MASTER CRUD
// =========================================================================
export function PoliciesCrudTab({ onNotify }: NotifyProp) {
  const { policies, addPolicy, updatePolicy, deletePolicy } = useDynamicStore();
  const [editing, setEditing] = useState<PolicyMasterDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [policyNumber, setPolicyNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2024');
  const [coverageLimit, setCoverageLimit] = useState('50000');
  const [deductible, setDeductible] = useState('500');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2027-01-01');

  const openCreate = () => {
    setEditing(null);
    setPolicyNumber(`POL-OMNI-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setHolderName('');
    setVin('');
    setMake('');
    setModel('');
    setYear('2025');
    setCoverageLimit('50000');
    setDeductible('500');
    setShowForm(true);
  };

  const openEdit = (p: PolicyMasterDto) => {
    setEditing(p);
    setPolicyNumber(p.policyNumber);
    setHolderName(p.policyHolderName);
    setVin(p.vehicleVin);
    setMake(p.vehicleMake);
    setModel(p.vehicleModel);
    setYear(String(p.vehicleYear));
    setCoverageLimit(String(p.coverageLimit));
    setDeductible(String(p.baseDeductible));
    setStartDate(p.startDate);
    setEndDate(p.endDate);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      policyNumber,
      policyHolderName: holderName,
      policyHolderId: editing?.policyHolderId || 'u-5',
      vehicleVin: vin.toUpperCase(),
      vehicleMake: make,
      vehicleModel: model,
      vehicleYear: Number(year) || 2024,
      coverageLimit: Number(coverageLimit) || 50000,
      baseDeductible: Number(deductible) || 500,
      startDate,
      endDate,
      isActive: editing ? editing.isActive : true,
    };

    if (editing) {
      updatePolicy(editing.id, payload);
      onNotify(`Policy ${policyNumber} updated.`);
    } else {
      addPolicy(payload);
      onNotify(`New policy ${policyNumber} created.`);
    }
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Dynamic Insurance Policies Master</h3>
          <p className="text-xs text-muted-foreground">Add, edit, activate/suspend, or delete policies dynamically anytime.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Policy
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <input required placeholder="Policy #" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required placeholder="Policyholder Name" value={holderName} onChange={(e) => setHolderName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <input required placeholder="Vehicle VIN" value={vin} onChange={(e) => setVin(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono uppercase" />
          <input required placeholder="Make (e.g. Tesla)" value={make} onChange={(e) => setMake(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <input required placeholder="Model (e.g. Model Y)" value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <input required type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required type="number" placeholder="Coverage Limit ($)" value={coverageLimit} onChange={(e) => setCoverageLimit(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required type="number" placeholder="Base Deductible ($)" value={deductible} onChange={(e) => setDeductible(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <div className="md:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">
              {editing ? 'Update Policy' : 'Create Policy'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 px-3">Policy # &amp; Holder</th>
              <th className="py-2.5 px-3">Vehicle &amp; VIN</th>
              <th className="py-2.5 px-3 text-right">Limit / Deductible</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {policies.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="py-2.5 px-3">
                  <div className="font-mono font-bold text-primary">{p.policyNumber}</div>
                  <div className="text-muted-foreground">{p.policyHolderName}</div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-foreground">{p.vehicleYear} {p.vehicleMake} {p.vehicleModel}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{p.vehicleVin}</div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono">
                  <div className="font-bold text-foreground">${p.coverageLimit.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Ded: ${p.baseDeductible}</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <button
                    onClick={() => {
                      updatePolicy(p.id, { isActive: !p.isActive });
                      onNotify(`Policy ${p.policyNumber} marked ${!p.isActive ? 'Active' : 'Inactive'}.`);
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      p.isActive
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Suspended'}
                  </button>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => openEdit(p)} className="rounded bg-muted p-1.5 hover:bg-muted/80" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { deletePolicy(p.id); onNotify(`Policy ${p.policyNumber} deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5 hover:bg-rose-500/20" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// TAB 4: PARTS CATALOG & DEPRECIATION RULES CRUD
// =========================================================================
export function PartsAndDepreciationTab({ onNotify }: NotifyProp) {
  const {
    partsCatalog,
    addPart,
    updatePart,
    deletePart,
    depreciationRules,
    addDepreciationRule,
    updateDepreciationRule,
    deleteDepreciationRule,
  } = useDynamicStore();

  // Part Form
  const [editPart, setEditPart] = useState<VehiclePartCatalogDto | null>(null);
  const [showPartForm, setShowPartForm] = useState(false);
  const [partCode, setPartCode] = useState('');
  const [partName, setPartName] = useState('');
  const [partType, setPartType] = useState<VehiclePartType>('BUMPER_FRONT');
  const [materialType, setMaterialType] = useState<MaterialType>('PLASTIC');
  const [oemBasePrice, setOemBasePrice] = useState('450');
  const [aftermarketPrice, setAftermarketPrice] = useState('280');
  const [laborHours, setLaborHours] = useState('2.0');

  // Depreciation Form
  const [editDep, setEditDep] = useState<DepreciationRuleDto | null>(null);
  const [showDepForm, setShowDepForm] = useState(false);
  const [depName, setDepName] = useState('');
  const [depMaterial, setDepMaterial] = useState<MaterialType>('METAL');
  const [minAge, setMinAge] = useState('0');
  const [maxAge, setMaxAge] = useState('5');
  const [depPct, setDepPct] = useState('25');

  const savePart = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      partCode: partCode.toUpperCase(),
      partName,
      partType,
      materialType,
      oemBasePrice: Number(oemBasePrice) || 0,
      aftermarketPrice: Number(aftermarketPrice) || 0,
      defaultLaborHours: Number(laborHours) || 1,
      laborRatePerHour: 90,
      isActive: true,
    };
    if (editPart) {
      updatePart(editPart.id, data);
      onNotify(`Part ${partCode} updated.`);
    } else {
      addPart(data);
      onNotify(`Part ${partCode} added to catalog.`);
    }
    setShowPartForm(false);
  };

  const saveDep = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: depName,
      materialType: depMaterial,
      minVehicleAgeYears: Number(minAge) || 0,
      maxVehicleAgeYears: Number(maxAge) || 100,
      depreciationPercent: Number(depPct) || 0,
      priority: depreciationRules.length + 1,
      isActive: true,
    };
    if (editDep) {
      updateDepreciationRule(editDep.id, data);
      onNotify(`Depreciation rule "${depName}" updated.`);
    } else {
      addDepreciationRule(data);
      onNotify(`Depreciation rule "${depName}" added.`);
    }
    setShowDepForm(false);
  };

  return (
    <div className="space-y-8">
      {/* Parts Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Dynamic Vehicle Parts &amp; Pricing Catalog</h3>
            <p className="text-xs text-muted-foreground">Real-time OEM/Aftermarket reference pricing &amp; labor benchmarks.</p>
          </div>
          <button
            onClick={() => {
              setEditPart(null);
              setPartCode(`PRT-${Math.floor(100 + Math.random() * 900)}`);
              setPartName('');
              setShowPartForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Part
          </button>
        </div>

        {showPartForm && (
          <form onSubmit={savePart} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <input required placeholder="Part Code" value={partCode} onChange={(e) => setPartCode(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required placeholder="Part Name" value={partName} onChange={(e) => setPartName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
            <select value={partType} onChange={(e) => setPartType(e.target.value as VehiclePartType)} className="rounded-lg border border-border bg-background px-3 py-1.5">
              <option value="BUMPER_FRONT">BUMPER_FRONT</option>
              <option value="BUMPER_REAR">BUMPER_REAR</option>
              <option value="HOOD_BONNET">HOOD_BONNET</option>
              <option value="HEADLIGHT_LEFT">HEADLIGHT_LEFT</option>
              <option value="WINDSHIELD_FRONT">WINDSHIELD_FRONT</option>
              <option value="DOOR_FRONT_LEFT">DOOR_FRONT_LEFT</option>
              <option value="FENDER_LEFT">FENDER_LEFT</option>
              <option value="ALLOY_WHEEL">ALLOY_WHEEL</option>
            </select>
            <select value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialType)} className="rounded-lg border border-border bg-background px-3 py-1.5">
              <option value="PLASTIC">PLASTIC</option>
              <option value="METAL">METAL</option>
              <option value="GLASS">GLASS</option>
              <option value="RUBBER">RUBBER</option>
              <option value="FIBERGLASS">FIBERGLASS</option>
            </select>
            <input required type="number" placeholder="OEM Price ($)" value={oemBasePrice} onChange={(e) => setOemBasePrice(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required type="number" placeholder="Aftermarket ($)" value={aftermarketPrice} onChange={(e) => setAftermarketPrice(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required type="number" step="0.5" placeholder="Labor Hours" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPartForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 font-bold">Save</button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
              <tr>
                <th className="py-2.5 px-3">Code &amp; Part</th>
                <th className="py-2.5 px-3">Part / Material</th>
                <th className="py-2.5 px-3 text-right">OEM / Aftermarket</th>
                <th className="py-2.5 px-3 text-center">Labor Hrs</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {partsCatalog.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-primary block">{p.partCode}</span>
                    <span className="font-medium text-foreground">{p.partName}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{p.partType} · {p.materialType}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    <span className="font-bold text-foreground">${p.oemBasePrice.toFixed(2)}</span>
                    <span className="block text-[10px] text-muted-foreground">AM: ${p.aftermarketPrice.toFixed(2)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{p.defaultLaborHours}h</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditPart(p);
                          setPartCode(p.partCode);
                          setPartName(p.partName);
                          setPartType(p.partType);
                          setMaterialType(p.materialType);
                          setOemBasePrice(String(p.oemBasePrice));
                          setAftermarketPrice(String(p.aftermarketPrice));
                          setLaborHours(String(p.defaultLaborHours));
                          setShowPartForm(true);
                        }}
                        className="rounded bg-muted p-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { deletePart(p.id); onNotify(`Part ${p.partCode} removed.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Depreciation Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Dynamic Actuarial Depreciation Schedule</h3>
            <p className="text-xs text-muted-foreground">Modify age brackets &amp; material depreciation percentages live.</p>
          </div>
          <button
            onClick={() => {
              setEditDep(null);
              setDepName('');
              setShowDepForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Depreciation Rule
          </button>
        </div>

        {showDepForm && (
          <form onSubmit={saveDep} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
            <input required placeholder="Rule Name" value={depName} onChange={(e) => setDepName(e.target.value)} className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-1.5" />
            <select value={depMaterial} onChange={(e) => setDepMaterial(e.target.value as MaterialType)} className="rounded-lg border border-border bg-background px-3 py-1.5">
              <option value="METAL">METAL</option>
              <option value="PLASTIC">PLASTIC</option>
              <option value="GLASS">GLASS</option>
              <option value="RUBBER">RUBBER</option>
              <option value="FIBERGLASS">FIBERGLASS</option>
            </select>
            <input required type="number" placeholder="Min Age" value={minAge} onChange={(e) => setMinAge(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required type="number" placeholder="Max Age" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required type="number" placeholder="Dep %" value={depPct} onChange={(e) => setDepPct(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <div className="md:col-span-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDepForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">Save Rule</button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
              <tr>
                <th className="py-2.5 px-3">Rule Title</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3 text-center">Age Band (Yrs)</th>
                <th className="py-2.5 px-3 text-center">Depreciation %</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {depreciationRules.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="py-2.5 px-3 font-semibold text-foreground">{r.name}</td>
                  <td className="py-2.5 px-3 font-mono text-primary">{r.materialType}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{r.minVehicleAgeYears} – {r.maxVehicleAgeYears} yrs</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">{r.depreciationPercent}%</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditDep(r);
                          setDepName(r.name);
                          setDepMaterial(r.materialType);
                          setMinAge(String(r.minVehicleAgeYears));
                          setMaxAge(String(r.maxVehicleAgeYears));
                          setDepPct(String(r.depreciationPercent));
                          setShowDepForm(true);
                        }}
                        className="rounded bg-muted p-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { deleteDepreciationRule(r.id); onNotify(`Depreciation rule deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// TAB 5: AUTOMATION RULES (STP & FRAUD) CRUD
// =========================================================================
export function AutomationRulesTab({ onNotify }: NotifyProp) {
  const { automationRules, addAutomationRule, updateAutomationRule, deleteAutomationRule } = useDynamicStore();
  const [editing, setEditing] = useState<AutomationRuleDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<AutomationRuleType>('FRAUD');
  const [metricKey, setMetricKey] = useState('gpsDistanceMeters');
  const [operator, setOperator] = useState<'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ' | 'NEQ'>('GT');
  const [thresholdValue, setThresholdValue] = useState('1000');
  const [riskWeight, setRiskWeight] = useState('25');
  const [action, setAction] = useState('ADD_RISK_SCORE');
  const [description, setDescription] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      ruleType,
      metricKey,
      operator,
      thresholdValue,
      riskWeight: Number(riskWeight) || 0,
      action,
      description,
      isActive: editing ? editing.isActive : true,
    };
    if (editing) {
      updateAutomationRule(editing.id, payload);
      onNotify(`Rule "${name}" updated.`);
    } else {
      addAutomationRule(payload);
      onNotify(`New ${ruleType} rule "${name}" added.`);
    }
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Dynamic STP &amp; Fraud Rules Engine</h3>
          <p className="text-xs text-muted-foreground">Create, tune weights/thresholds, toggle on/off, or delete engine rules anytime.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setName('');
            setDescription('');
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <input required placeholder="Rule Name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as AutomationRuleType)} className="rounded-lg border border-border bg-background px-3 py-1.5">
            <option value="STP">STP</option>
            <option value="FRAUD">FRAUD</option>
            <option value="WORKFLOW">WORKFLOW</option>
          </select>
          <input required placeholder="Metric Key (e.g. netPayout)" value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <div className="flex gap-2">
            <select value={operator} onChange={(e) => setOperator(e.target.value as any)} className="rounded-lg border border-border bg-background px-2 py-1.5 font-mono">
              <option value="LT">&lt;</option>
              <option value="LTE">&lt;=</option>
              <option value="GT">&gt;</option>
              <option value="GTE">&gt;=</option>
              <option value="EQ">==</option>
            </select>
            <input required placeholder="Threshold" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          </div>
          <input type="number" placeholder="Risk Weight" value={riskWeight} onChange={(e) => setRiskWeight(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required placeholder="Action (e.g. FLAG_SIU)" value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-1.5" />
          <div className="md:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">Save Rule</button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 px-3">Rule &amp; Type</th>
              <th className="py-2.5 px-3">Condition</th>
              <th className="py-2.5 px-3 text-center">Weight / Action</th>
              <th className="py-2.5 px-3 text-center">Enabled</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {automationRules.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20">
                <td className="py-2.5 px-3">
                  <div className="font-bold text-foreground flex items-center gap-2">
                    <span>{r.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      r.ruleType === 'STP' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>{r.ruleType}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{r.description}</div>
                </td>
                <td className="py-2.5 px-3 font-mono text-primary">
                  {r.metricKey} {r.operator} {r.thresholdValue}
                </td>
                <td className="py-2.5 px-3 text-center font-mono">
                  <span className="font-bold text-amber-400">+{r.riskWeight}</span> · {r.action}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <button
                    onClick={() => {
                      updateAutomationRule(r.id, { isActive: !r.isActive });
                      onNotify(`Rule "${r.name}" ${!r.isActive ? 'enabled' : 'disabled'}.`);
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      r.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.isActive ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => {
                        setEditing(r);
                        setName(r.name);
                        setRuleType(r.ruleType);
                        setMetricKey(r.metricKey);
                        setOperator(r.operator);
                        setThresholdValue(r.thresholdValue);
                        setRiskWeight(String(r.riskWeight));
                        setAction(r.action);
                        setDescription(r.description || '');
                        setShowForm(true);
                      }}
                      className="rounded bg-muted p-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { deleteAutomationRule(r.id); onNotify(`Rule "${r.name}" deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// TAB 6: REPAIR GARAGES NETWORK CRUD
// =========================================================================
export function GaragesCrudTab({ onNotify }: NotifyProp) {
  const { garages, addGarage, updateGarage, deleteGarage } = useDynamicStore();
  const [editing, setEditing] = useState<RepairGarageDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [rate, setRate] = useState('95');
  const [rating, setRating] = useState('4.5');
  const [email, setEmail] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      code: code.toUpperCase(),
      name,
      city,
      hourlyLaborRate: Number(rate) || 90,
      rating: Number(rating) || 4.5,
      email,
      isPreferredNetwork: editing ? editing.isPreferredNetwork : true,
      isBlacklisted: editing ? editing.isBlacklisted : false,
    };
    if (editing) {
      updateGarage(editing.id, data);
      onNotify(`Garage "${name}" updated.`);
    } else {
      addGarage(data);
      onNotify(`Garage "${name}" added to network.`);
    }
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Dynamic Repair Garage Network &amp; Blacklist</h3>
          <p className="text-xs text-muted-foreground">Manage preferred repair centers, hourly labor caps, and SIU blacklists.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setCode(`GRG-${Math.floor(100 + Math.random() * 900)}`);
            setName('');
            setCity('');
            setEmail('');
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Garage
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <input required placeholder="Garage Code" value={code} onChange={(e) => setCode(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required placeholder="Shop Name" value={name} onChange={(e) => setName(e.target.value)} className="md:col-span-2 rounded-lg border border-border bg-background px-3 py-1.5" />
          <input required placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <input required type="number" placeholder="Labor $/hr" value={rate} onChange={(e) => setRate(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required type="number" step="0.1" placeholder="Rating" value={rating} onChange={(e) => setRating(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <div className="md:col-span-6 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
            <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">Save Garage</button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
            <tr>
              <th className="py-2.5 px-3">Code &amp; Name</th>
              <th className="py-2.5 px-3">City</th>
              <th className="py-2.5 px-3 text-right">Labor Rate</th>
              <th className="py-2.5 px-3 text-center">Network Tier</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {garages.map((g) => (
              <tr key={g.id} className="hover:bg-muted/20">
                <td className="py-2.5 px-3">
                  <span className="font-mono font-bold text-primary block">{g.code}</span>
                  <span className="font-semibold text-foreground">{g.name}</span>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">{g.city}</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold">${g.hourlyLaborRate}/hr</td>
                <td className="py-2.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => {
                        updateGarage(g.id, { isPreferredNetwork: !g.isPreferredNetwork, isBlacklisted: false });
                        onNotify(`Updated preferred status for ${g.name}.`);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        g.isPreferredNetwork ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Star className="h-2.5 w-2.5" /> Preferred
                    </button>
                    <button
                      onClick={() => {
                        updateGarage(g.id, { isBlacklisted: !g.isBlacklisted, isPreferredNetwork: false });
                        onNotify(`${g.name} ${!g.isBlacklisted ? 'BLACKLISTED' : 'removed from blacklist'}.`);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        g.isBlacklisted ? 'bg-rose-500/20 text-rose-400' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Ban className="h-2.5 w-2.5" /> {g.isBlacklisted ? 'Blacklisted' : 'Clean'}
                    </button>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => {
                        setEditing(g);
                        setCode(g.code);
                        setName(g.name);
                        setCity(g.city);
                        setRate(String(g.hourlyLaborRate));
                        setRating(String(g.rating));
                        setEmail(g.email || '');
                        setShowForm(true);
                      }}
                      className="rounded bg-muted p-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { deleteGarage(g.id); onNotify(`Garage ${g.name} deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// TAB 7: DYNAMIC SIDEBAR MENU & PERMISSIONS BUILDER CRUD
// =========================================================================
export function MenusAndPermissionsTab({ onNotify }: NotifyProp) {
  const {
    menus,
    addMenu,
    updateMenu,
    deleteMenu,
    moveMenuOrder,
    permissionsCatalog,
    addPermission,
    deletePermission,
  } = useDynamicStore();

  const [editMenu, setEditMenu] = useState<DynamicMenuItemDto | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuKey, setMenuKey] = useState('');
  const [label, setLabel] = useState('');
  const [navLink, setNavLink] = useState('/claims');
  const [parentKey, setParentKey] = useState('');
  const [requiredPerm, setRequiredPerm] = useState('');
  const [badgeName, setBadgeName] = useState('');

  // New Permission form
  const [permSlug, setPermSlug] = useState('');
  const [permMod, setPermMod] = useState('CLAIMS');
  const [permAction, setPermAction] = useState('CUSTOM');
  const [permDesc, setPermDesc] = useState('');

  const saveMenu = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      menuKey: menuKey.toLowerCase().replace(/\s+/g, '-'),
      label,
      navLink: navLink || undefined,
      icon: parentKey ? 'Circle' : 'Layers',
      parentKey: parentKey || null,
      requiredPermission: requiredPerm || null,
      badgeName: badgeName || null,
      badgeColor: 'bg-primary/20 text-primary',
      sortOrder: editMenu ? editMenu.sortOrder : menus.length + 1,
      isVisible: editMenu ? editMenu.isVisible : true,
    };
    if (editMenu) {
      updateMenu(editMenu.id, data);
      onNotify(`Menu "${label}" updated — Sidebar refreshed live!`);
    } else {
      addMenu(data);
      onNotify(`New menu "${label}" added to Sidebar live!`);
    }
    setShowMenuForm(false);
  };

  const handleAddPerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permSlug.trim()) return;
    addPermission({
      slug: permSlug.toLowerCase().trim(),
      module: permMod.toUpperCase(),
      action: permAction.toUpperCase(),
      description: permDesc || 'Custom dynamic permission',
    });
    setPermSlug('');
    setPermDesc('');
    onNotify(`Custom permission "${permSlug}" added to RBAC catalog.`);
  };

  const parentMenus = menus.filter((m) => !m.parentKey);

  return (
    <div className="space-y-8">
      {/* Live Sidebar Menu Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Dynamic Sidebar Menu Builder (Live College ERP MenuOrder)</h3>
            <p className="text-xs text-muted-foreground">Add, edit, reorder, hide/show, or delete sidebar menu items — takes effect instantly!</p>
          </div>
          <button
            onClick={() => {
              setEditMenu(null);
              setMenuKey(`custom-${Date.now().toString().slice(-4)}`);
              setLabel('');
              setNavLink('/claims');
              setParentKey('');
              setRequiredPerm('');
              setBadgeName('');
              setShowMenuForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Menu Item
          </button>
        </div>

        {showMenuForm && (
          <form onSubmit={saveMenu} className="rounded-xl border border-primary/30 bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input required placeholder="Menu Key" value={menuKey} onChange={(e) => setMenuKey(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input required placeholder="Display Label" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
            <input placeholder="Route Link (e.g. /claims)" value={navLink} onChange={(e) => setNavLink(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <select value={parentKey} onChange={(e) => setParentKey(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5">
              <option value="">Top-Level Master Section</option>
              {parentMenus.map((pm) => (
                <option key={pm.id} value={pm.menuKey}>Child of: {pm.label}</option>
              ))}
            </select>
            <input placeholder="Required Permission (optional)" value={requiredPerm} onChange={(e) => setRequiredPerm(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
            <input placeholder="Badge Label (optional)" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
            <div className="md:col-span-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowMenuForm(false)} className="rounded-lg border border-border px-3 py-1.5">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-1.5 font-bold">Save Menu</button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
              <tr>
                <th className="py-2.5 px-3">Label &amp; Key</th>
                <th className="py-2.5 px-3">Parent / Route</th>
                <th className="py-2.5 px-3">Required Permission</th>
                <th className="py-2.5 px-3 text-center">Order / Visibility</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {menus.map((m) => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="py-2 px-3">
                    <span className={`font-bold ${m.parentKey ? 'pl-4 text-muted-foreground' : 'text-foreground'}`}>
                      {m.parentKey ? '↳ ' : ''}{m.label}
                    </span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{m.menuKey}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">{m.navLink || '(Group Folder)'}</td>
                  <td className="py-2 px-3 font-mono text-primary">{m.requiredPermission || 'Public'}</td>
                  <td className="py-2 px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => moveMenuOrder(m.id, 'UP')} className="rounded bg-muted p-1 hover:bg-muted/80" title="Move Up"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => moveMenuOrder(m.id, 'DOWN')} className="rounded bg-muted p-1 hover:bg-muted/80" title="Move Down"><ArrowDown className="h-3 w-3" /></button>
                      <button
                        onClick={() => {
                          updateMenu(m.id, { isVisible: !m.isVisible });
                          onNotify(`Menu "${m.label}" ${!m.isVisible ? 'shown' : 'hidden'}.`);
                        }}
                        className={`rounded p-1 ${m.isVisible ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}
                        title="Toggle Visibility"
                      >
                        {m.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditMenu(m);
                          setMenuKey(m.menuKey);
                          setLabel(m.label);
                          setNavLink(m.navLink || '');
                          setParentKey(m.parentKey || '');
                          setRequiredPerm(m.requiredPermission || '');
                          setBadgeName(m.badgeName || '');
                          setShowMenuForm(true);
                        }}
                        className="rounded bg-muted p-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { deleteMenu(m.id); onNotify(`Menu "${m.label}" deleted.`); }} className="rounded bg-rose-500/10 text-rose-500 p-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Granular Dynamic Permissions Catalog */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Dynamic RBAC Permissions Catalog ({permissionsCatalog.length} Slugs)</h3>
        <form onSubmit={handleAddPerm} className="rounded-xl border border-border bg-muted/20 p-3 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
          <input required placeholder="Slug (e.g. claims:export_pdf)" value={permSlug} onChange={(e) => setPermSlug(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono" />
          <input required placeholder="Module (e.g. CLAIMS)" value={permMod} onChange={(e) => setPermMod(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 uppercase" />
          <input required placeholder="Action Label" value={permAction} onChange={(e) => setPermAction(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 uppercase" />
          <input placeholder="Description" value={permDesc} onChange={(e) => setPermDesc(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5" />
          <button type="submit" className="rounded-lg bg-primary text-primary-foreground font-bold px-3 py-1.5 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Add Permission
          </button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {permissionsCatalog.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-xs">
              <div>
                <div className="font-mono font-bold text-primary">{p.slug}</div>
                <div className="text-[10px] text-muted-foreground">{p.module} · {p.description}</div>
              </div>
              <button onClick={() => { deletePermission(p.id); onNotify(`Permission ${p.slug} deleted.`); }} className="text-rose-500 hover:bg-rose-500/10 p-1 rounded">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
