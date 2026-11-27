'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RequirePageAccess } from '@/components/auth/require-page-access';
import { apiRequest } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import {
  ShieldCheck,
  Car,
  HeartPulse,
  Home,
  Plane,
  Shield,
  CheckCircle2,
  FileText,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
} from 'lucide-react';

interface VehicleTypeItem {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface PolicyProduct {
  id: string;
  productCode: string;
  vehicleTypeId?: string | null;
  vehicleType?: VehicleTypeItem | null;
  name: string;
  description: string;
  baseRateAnnual: string | number;
  minCoverageAmount: string | number;
  maxCoverageAmount: string | number;
  defaultDeductible: string | number;
  termMonthsOptions: number[];
  requiredDocumentsJson: string[];
  exclusionsJson?: string[];
  addonsJson?: string[];
  category: {
    id: string;
    code: string;
    name: string;
    requiresUnderwriting: boolean;
  };
}

interface PolicyCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  requiresUnderwriting: boolean;
  vehicleTypes?: VehicleTypeItem[];
  products: PolicyProduct[];
}

const CAT_ICONS: Record<string, React.ReactNode> = {
  AUTO: <Car className="h-5 w-5" />,
  HEALTH: <HeartPulse className="h-5 w-5" />,
  HOME: <Home className="h-5 w-5" />,
  LIFE: <Shield className="h-5 w-5" />,
  TRAVEL: <Plane className="h-5 w-5" />,
};

export default function PolicyApplyPage() {
  const { userName, userEmail } = usePermissions();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('AUTO');
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<PolicyProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Coverage & Risk form state
  const [requestedCoverage, setRequestedCoverage] = useState('50000');
  const [requestedDeductible, setRequestedDeductible] = useState('500');
  const [termMonths, setTermMonths] = useState('12');
  const [phone, setPhone] = useState('+1-555-0194');
  const [address, setAddress] = useState('742 Evergreen Terrace, Austin, TX');
  const [vehicleVin, setVehicleVin] = useState('1HGCM82633A004352');
  const [vehicleMake, setVehicleMake] = useState('Honda');
  const [vehicleModel, setVehicleModel] = useState('Accord Hybrid');
  const [vehicleYear, setVehicleYear] = useState('2024');
  const [applicantAge, setApplicantAge] = useState('34');
  const [propertyAddress, setPropertyAddress] = useState('742 Evergreen Terrace, Austin, TX');
  const [destination, setDestination] = useState('European Union');

  // Step 3: Document attach state
  const [docType, setDocType] = useState('ID_PROOF');
  const [docFileName, setDocFileName] = useState('government_id_verified.pdf');
  const [attachedDocs, setAttachedDocs] = useState<any[]>([]);

  // Application, Quote & Issued Policy state
  const [application, setApplication] = useState<any | null>(null);
  const [activeQuote, setActiveQuote] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'ACH' | 'UPI' | 'STRIPE'>('CARD');
  const [issuedPolicy, setIssuedPolicy] = useState<any | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const res = await apiRequest<PolicyCategory[]>('GET', '/api/v1/policy-catalog/categories');
    if (res.ok && res.data) {
      setCategories(res.data);
      const firstCat = res.data[0];
      if (firstCat) {
        setSelectedCat(firstCat.code);
        const firstVt = firstCat.vehicleTypes?.[0]?.id || '';
        setSelectedVehicleTypeId(firstVt);
        const matchingProducts = firstVt
          ? firstCat.products.filter((p) => p.vehicleTypeId === firstVt)
          : firstCat.products;
        const firstProd = matchingProducts[0] || firstCat.products[0];
        if (firstProd) {
          setSelectedProduct(firstProd);
          setRequestedCoverage(String(Math.max(Number(firstProd.minCoverageAmount), 50000)));
          setRequestedDeductible(String(firstProd.defaultDeductible));
        }
      }
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleSelectProduct = (prod: PolicyProduct, catCode: string) => {
    setSelectedCat(catCode);
    setSelectedProduct(prod);
    setRequestedCoverage(String(Math.min(Number(prod.maxCoverageAmount), Math.max(Number(prod.minCoverageAmount), 50000))));
    setRequestedDeductible(String(prod.defaultDeductible));
    setDocType(prod.requiredDocumentsJson?.[0] || 'ID_PROOF');
  };

  const buildRiskPayload = () => {
    if (selectedCat === 'AUTO') {
      return { vehicleVin, vehicleMake, vehicleModel, vehicleYear: Number(vehicleYear) };
    }
    if (selectedCat === 'HEALTH') {
      return { applicantAge: Number(applicantAge), planTier: 'FAMILY_FLOATER' };
    }
    if (selectedCat === 'HOME') {
      return { propertyAddress, propertyAgeYears: 8, planTier: 'HOME_SHIELD' };
    }
    if (selectedCat === 'TRAVEL') {
      return { destination, tripDays: 14, planTier: 'GLOBAL_GUARD' };
    }
    return { applicantAge: Number(applicantAge), smoker: false, planTier: 'TERM_LIFE' };
  };

  const handleSaveDraft = async () => {
    if (!selectedProduct) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      productId: selectedProduct.id,
      ...(selectedVehicleTypeId ? { vehicleTypeId: selectedVehicleTypeId } : {}),
      requestedCoverage: Number(requestedCoverage),
      requestedDeductible: Number(requestedDeductible),
      termMonths: Number(termMonths),
      applicantDetailsJson: {
        fullName: userName || 'Applicant',
        email: userEmail || 'applicant@omniclaim.internal',
        phone,
        address,
      },
      riskDetailsJson: buildRiskPayload(),
    };

    const res = application
      ? await apiRequest('PATCH', `/api/v1/policy-applications/${application.id}`, payload)
      : await apiRequest('POST', '/api/v1/policy-applications', payload);

    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Failed to save draft application.');
      return;
    }
    setApplication(res.data);
    setStep(3);
  };

  const handleAttachDoc = async () => {
    if (!application) return;
    setError(null);
    const res = await apiRequest('POST', `/api/v1/policy-applications/${application.id}/documents`, {
      docType,
      fileName: docFileName,
      mimeType: 'application/pdf',
      fileSizeBytes: 184320,
      fileUrl: `https://storage.omniclaim.internal/applications/${application.id}/${docFileName}`,
    });
    if (res.ok && res.data) {
      setAttachedDocs((prev) => [res.data, ...prev]);
    } else {
      setError(res.error || 'Failed to attach document.');
    }
  };

  const handleSubmitApplication = async () => {
    if (!application) return;
    setError(null);
    setSubmitting(true);
    const res = await apiRequest<{ application: any; quote?: any; autoQuoted: boolean }>(
      'POST',
      `/api/v1/policy-applications/${application.id}/submit`,
      {},
    );
    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Failed to submit application.');
      return;
    }
    setApplication(res.data.application);
    setActiveQuote(res.data.quote || res.data.application?.quotes?.[0] || null);
    setStep(4);
  };

  const handleAcceptQuote = async () => {
    if (!application || !activeQuote) return;
    setError(null);
    setSubmitting(true);
    const res = await apiRequest<{ quote: any; application: any }>(
      'POST',
      `/api/v1/policy-applications/${application.id}/quotes/${activeQuote.id}/accept`,
      {},
    );
    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Failed to accept quote.');
      return;
    }
    setActiveQuote(res.data.quote);
    setApplication(res.data.application);
    setStep(5);
  };

  const handlePayAndIssue = async () => {
    if (!application) return;
    setError(null);
    setSubmitting(true);
    const res = await apiRequest<{ policy: any; payment: any; application: any }>(
      'POST',
      `/api/v1/policy-applications/${application.id}/pay-and-issue`,
      {
        paymentMethod,
        idempotencyKey: `POLPAY-${application.id}`,
        quoteId: activeQuote?.id,
      },
    );
    setSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Payment & policy issuance failed.');
      return;
    }
    setIssuedPolicy(res.data.policy);
    setApplication(res.data.application);
  };

  const activeCategoryObj = categories.find((c) => c.code === selectedCat);

  return (
    <RequirePageAccess permission={['policies:apply', 'policies:read']} title="Policy Application">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Policy Application &amp; Instant Issuance
            </h1>
            <p className="text-sm text-muted-foreground">
              Select a category, configure coverage, attach verification documents, review your live quote, and issue a binding policy.
            </p>
          </div>
          <Link
            href="/policies"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            View My Policies Portfolio
          </Link>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-5 gap-2 rounded-xl border border-border bg-card p-3 text-xs">
          {[
            { n: 1, label: '1. Category & Plan' },
            { n: 2, label: '2. Coverage & Risk' },
            { n: 3, label: '3. Documents' },
            { n: 4, label: '4. Quote Review' },
            { n: 5, label: '5. Pay & Issue' },
          ].map((item) => (
            <div
              key={item.n}
              className={`rounded-lg px-3 py-2 font-semibold text-center transition ${
                step === item.n
                  ? 'bg-primary text-primary-foreground shadow'
                  : step > item.n
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* STEP 1: CATEGORY & PRODUCT */}
        {step === 1 && (
          <div className="space-y-5">
            {loading ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Loading live policy catalog...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {categories.map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => {
                        setSelectedCat(cat.code);
                        const firstVt = cat.vehicleTypes?.[0]?.id || '';
                        setSelectedVehicleTypeId(firstVt);
                        const matching = firstVt
                          ? cat.products.filter((p) => p.vehicleTypeId === firstVt)
                          : cat.products;
                        const nextProd = matching[0] || cat.products[0];
                        if (nextProd) handleSelectProduct(nextProd, cat.code);
                        else setSelectedProduct(null);
                      }}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                        selectedCat === cat.code
                          ? 'border-primary bg-primary/10 text-foreground shadow'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <div className="text-primary">{CAT_ICONS[cat.code] || <Shield className="h-5 w-5" />}</div>
                      <div className="font-bold text-sm text-foreground">{cat.name}</div>
                      <div className="text-[11px] line-clamp-2">{cat.description}</div>
                    </button>
                  ))}
                </div>

                {/* Step 1b: Configurable Vehicle Type Selector (when Category defines Vehicle Types) */}
                {activeCategoryObj?.vehicleTypes && activeCategoryObj.vehicleTypes.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="text-xs font-bold text-foreground">
                      Step 2: Choose Vehicle Type under {activeCategoryObj.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeCategoryObj.vehicleTypes.map((vt) => (
                        <button
                          key={vt.id}
                          type="button"
                          onClick={() => {
                            setSelectedVehicleTypeId(vt.id);
                            const eligible = activeCategoryObj.products.filter((p) => p.vehicleTypeId === vt.id);
                            if (eligible[0]) handleSelectProduct(eligible[0], activeCategoryObj.code);
                            else setSelectedProduct(null);
                          }}
                          className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${
                            selectedVehicleTypeId === vt.id
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {vt.name} ({vt.code})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeCategoryObj && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(activeCategoryObj.vehicleTypes && activeCategoryObj.vehicleTypes.length > 0 && selectedVehicleTypeId
                      ? activeCategoryObj.products.filter((p) => p.vehicleTypeId === selectedVehicleTypeId)
                      : activeCategoryObj.products
                    ).map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectProduct(prod, activeCategoryObj.code)}
                        className={`cursor-pointer rounded-xl border p-5 transition ${
                          selectedProduct?.id === prod.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                              {prod.productCode}
                            </span>
                            <h3 className="text-lg font-bold text-foreground">{prod.name}</h3>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-foreground">
                              ${Number(prod.baseRateAnnual).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-muted-foreground">base / year</div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{prod.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded bg-muted px-2 py-0.5">
                            Cover: ${Number(prod.minCoverageAmount).toLocaleString()} – ${Number(prod.maxCoverageAmount).toLocaleString()}
                          </span>
                          <span className="rounded bg-muted px-2 py-0.5">
                            Default Deductible: ${Number(prod.defaultDeductible).toLocaleString()}
                          </span>
                          {prod.addonsJson && prod.addonsJson.length > 0 && (
                            <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-semibold">
                              Add-ons: {prod.addonsJson.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Configure Coverage &amp; Risk <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2: COVERAGE & CATEGORY-SPECIFIC RISK DETAILS */}
        {step === 2 && selectedProduct && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-bold">{selectedProduct.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Coverage limits: ${Number(selectedProduct.minCoverageAmount).toLocaleString()} – ${Number(selectedProduct.maxCoverageAmount).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                {selectedCat}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Requested Coverage ($)</label>
                <input
                  type="number"
                  value={requestedCoverage}
                  onChange={(e) => setRequestedCoverage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Deductible ($)</label>
                <input
                  type="number"
                  value={requestedDeductible}
                  onChange={(e) => setRequestedDeductible(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Term (Months)</label>
                <select
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {(selectedProduct.termMonthsOptions || [6, 12, 24]).map((m) => (
                    <option key={m} value={m}>
                      {m} Months
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">Insured Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {selectedCat === 'AUTO' && (
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 md:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Vehicle VIN</label>
                  <input value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Make</label>
                  <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Model</label>
                  <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Year</label>
                  <input type="number" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
                </div>
              </div>
            )}

            {(selectedCat === 'HEALTH' || selectedCat === 'LIFE') && (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="block text-xs font-semibold mb-1">Primary Applicant Age</label>
                <input type="number" value={applicantAge} onChange={(e) => setApplicantAge(e.target.value)} className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-xs" />
              </div>
            )}

            {selectedCat === 'HOME' && (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="block text-xs font-semibold mb-1">Insured Property Address</label>
                <input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
              </div>
            )}

            {selectedCat === 'TRAVEL' && (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="block text-xs font-semibold mb-1">Travel Destination Region</label>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? 'Saving Draft...' : 'Save Draft & Attach Documents'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DOCUMENT ATTACHMENT & SUBMISSION */}
        {step === 3 && application && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Supporting Documents — {application.applicationNumber}
              </h2>
              <p className="text-xs text-muted-foreground">
                Required documents for this product: {(selectedProduct?.requiredDocumentsJson || []).join(', ')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
              >
                {(selectedProduct?.requiredDocumentsJson || ['ID_PROOF']).map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
              <input
                value={docFileName}
                onChange={(e) => setDocFileName(e.target.value)}
                placeholder="File name..."
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleAttachDoc}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20"
              >
                <Upload className="h-4 w-4" /> Attach Document
              </button>
            </div>

            {attachedDocs.length > 0 && (
              <div className="space-y-1.5">
                {attachedDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-semibold">{d.docType} — {d.fileName} (v{d.version})</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      {d.reviewStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Edit Details
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitApplication}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit Application & Calculate Quote'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: QUOTE REVIEW OR UNDERWRITING QUEUED */}
        {step === 4 && application && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Application Status: {application.status}</h2>
                <p className="text-xs text-muted-foreground">Reference: {application.applicationNumber}</p>
              </div>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                {application.status}
              </span>
            </div>

            {activeQuote ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-emerald-400">{activeQuote.quoteNumber}</div>
                    <div className="text-2xl font-black text-foreground">
                      ${Number(activeQuote.totalPremium).toLocaleString()}
                      <span className="text-xs font-normal text-muted-foreground"> / {activeQuote.termMonths} months</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Coverage: ${Number(activeQuote.coverageAmount).toLocaleString()}</div>
                    <div>Deductible: ${Number(activeQuote.deductible).toLocaleString()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 border-t border-border pt-3 text-xs">
                  <div>Base: ${Number(activeQuote.basePremium).toFixed(2)}</div>
                  <div>Risk Loading: ${Number(activeQuote.riskLoading).toFixed(2)}</div>
                  <div>Discount: -${Number(activeQuote.discountAmount).toFixed(2)}</div>
                  <div>Tax (8%): ${Number(activeQuote.taxAmount).toFixed(2)}</div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleAcceptQuote}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Accept Quote &amp; Proceed to Payment <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                <div className="font-bold">Submitted for Underwriting Review</div>
                <p className="text-xs">
                  Thank you for applying. An underwriter is reviewing your details and will send your quote shortly. You can check the status anytime in My Policies.
                </p>
                <Link
                  href="/policies"
                  className="inline-block rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-500/30"
                >
                  View Application Status
                </Link>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: PAYMENT & POLICY ISSUANCE */}
        {step === 5 && application && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {issuedPolicy ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-lg">
                  <CheckCircle2 className="h-6 w-6" /> Policy Issued &amp; Active!
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                  <div>
                    <div className="text-muted-foreground">Policy Number</div>
                    <div className="font-mono font-bold text-foreground">{issuedPolicy.policyNumber}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Coverage Limit</div>
                    <div className="font-bold">${Number(issuedPolicy.coverageLimit).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Annual Premium</div>
                    <div className="font-bold">${Number(issuedPolicy.annualPremium).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div className="font-bold text-emerald-400">{issuedPolicy.lifecycleStatus}</div>
                  </div>
                </div>
                <div className="pt-2 flex gap-3">
                  <Link
                    href="/policies"
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Manage Policy (Endorse / Renew)
                  </Link>
                  <Link
                    href="/claims?action=new"
                    className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-muted"
                  >
                    File a Claim
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Complete Payment &amp; Activate Policy
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paying Quote {activeQuote?.quoteNumber}: <strong className="text-foreground">${Number(activeQuote?.totalPremium || 0).toLocaleString()}</strong>
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {(['CARD', 'ACH', 'UPI', 'STRIPE'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-xl border py-3 text-xs font-bold ${
                        paymentMethod === m ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePayAndIssue}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    {submitting ? 'Processing Payment...' : 'Pay Premium & Issue Binding Policy'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </RequirePageAccess>
  );
}
