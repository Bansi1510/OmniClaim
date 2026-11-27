'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { Can } from '@/components/auth/can';
import {
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

export type CaptureStepKey =
  | 'FRONT_VIEW'
  | 'REAR_VIEW'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'DAMAGE_CLOSEUP'
  | 'NUMBER_PLATE'
  | 'ADDITIONAL';

const CAPTURE_STEPS: Array<{
  key: CaptureStepKey;
  title: string;
  instruction: string;
  frameHint: string;
}> = [
  {
    key: 'FRONT_VIEW',
    title: '1. Front View of Vehicle',
    instruction: 'Stand directly in front of the vehicle and fit the entire bumper, hood, and headlights inside the frame.',
    frameHint: 'Center front bumper & headlights inside guide box',
  },
  {
    key: 'REAR_VIEW',
    title: '2. Rear View of Vehicle',
    instruction: 'Capture the full rear bumper, taillights, and trunk/tailgate clearly in good lighting.',
    frameHint: 'Align rear bumper & taillights cleanly',
  },
  {
    key: 'LEFT_SIDE',
    title: '3. Left Side View',
    instruction: 'Step back so the entire left (driver) side doors, fenders, and wheels are visible.',
    frameHint: 'Fit full left profile from front wheel to rear wheel',
  },
  {
    key: 'RIGHT_SIDE',
    title: '4. Right Side View',
    instruction: 'Step back so the entire right (passenger) side panels and mirrors fit inside the frame.',
    frameHint: 'Fit full right profile inside horizontal guides',
  },
  {
    key: 'DAMAGE_CLOSEUP',
    title: '5. Close-Up of Damaged Area',
    instruction: 'Move closer (1–2 ft) to capture dents, scratches, broken glass, or structural impact clearly.',
    frameHint: 'Focus directly on primary impact & scratches',
  },
  {
    key: 'NUMBER_PLATE',
    title: '6. Vehicle Number Plate',
    instruction: 'Fill the central rectangle with the license/registration number plate so every character is readable.',
    frameHint: 'Keep license plate characters crisp and unblurred',
  },
  {
    key: 'ADDITIONAL',
    title: '7. Additional Claim Evidence',
    instruction: 'Capture any extra angle, odometer reading, airbag deployment, or scene context required by your claim.',
    frameHint: 'Optional/additional scene or odometer context',
  },
];

interface CapturedPhotoState {
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  previewDataUrl?: string;
  evidenceId?: string;
  checksum?: string;
  error?: string;
}

export function LiveCameraCapture({
  claimId,
  onUploaded,
}: {
  claimId: string;
  onUploaded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, CapturedPhotoState>>({});

  // Staff exception upload state (no gallery option for normal customers!)
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [staffReason, setStaffReason] = useState('');
  const [staffFileDataUrl, setStaffFileDataUrl] = useState<string | null>(null);
  const [staffStatus, setStaffStatus] = useState<string | null>(null);

  const currentStep = CAPTURE_STEPS[stepIdx];
  const completedCount = CAPTURE_STEPS.filter((s) => photos[s.key]?.status === 'uploaded').length;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live camera API is unavailable in this browser context. Please use HTTPS or localhost on a camera-enabled device.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings to capture claim photos.'
          : `Unable to start live camera: ${err?.message || 'No camera device detected'}`
      );
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Basic client-side brightness & sharpness check on captured frame
  const analyzeFrameQuality = (ctx: CanvasRenderingContext2D, width: number, height: number): string | null => {
    const sample = ctx.getImageData(0, 0, width, height).data;
    let sumLuma = 0;
    let edgeAccum = 0;
    const stride = 16; // Fast sampling every 4 pixels
    let count = 0;
    let prevLuma = 0;

    for (let i = 0; i < sample.length; i += stride) {
      const luma = 0.299 * sample[i] + 0.587 * sample[i + 1] + 0.114 * sample[i + 2];
      sumLuma += luma;
      if (count > 0) edgeAccum += Math.abs(luma - prevLuma);
      prevLuma = luma;
      count++;
    }

    const avgLuma = sumLuma / Math.max(1, count);
    const avgEdge = edgeAccum / Math.max(1, count);

    if (avgLuma < 42) {
      return 'Photo appears too dark. Move to brighter lighting or turn on flash and consider retaking.';
    }
    if (avgEdge < 4.5) {
      return 'Photo may be blurry or poorly framed. Hold steady and make sure the vehicle fills the frame.';
    }
    return null;
  };

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    setQualityWarning(analyzeFrameQuality(ctx, w, h));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPendingPreview(dataUrl);
  };

  const handleConfirmUpload = async () => {
    if (!pendingPreview) return;
    const stepKey = currentStep.key;
    setPhotos((prev) => ({
      ...prev,
      [stepKey]: { status: 'uploading', previewDataUrl: pendingPreview },
    }));

    const res = await apiRequest<any>('POST', `/api/v1/claims/${claimId}/evidence/capture`, {
      captureStep: stepKey,
      imageBase64: pendingPreview,
      mimeType: 'image/jpeg',
    });

    if (res.ok && res.data) {
      setPhotos((prev) => ({
        ...prev,
        [stepKey]: {
          status: 'uploaded',
          previewDataUrl: pendingPreview,
          evidenceId: res.data.id,
          checksum: res.data.checksumSha256,
        },
      }));
      setPendingPreview(null);
      setQualityWarning(null);
      onUploaded?.();
      if (stepIdx < CAPTURE_STEPS.length - 1) {
        setStepIdx((i) => i + 1);
      }
    } else {
      setPhotos((prev) => ({
        ...prev,
        [stepKey]: {
          status: 'failed',
          previewDataUrl: pendingPreview,
          error: res.error || 'Upload failed. Please retry.',
        },
      }));
    }
  };

  const handleStaffExceptionUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFileDataUrl || staffReason.trim().length < 5) {
      setStaffStatus('Provide both an image and a documented exception reason (min 5 chars).');
      return;
    }
    setStaffStatus('Uploading audited staff exception...');
    const res = await apiRequest<any>('POST', `/api/v1/claims/${claimId}/evidence/staff-upload`, {
      captureStep: currentStep.key,
      imageBase64: staffFileDataUrl,
      exceptionReason: staffReason.trim(),
    });
    if (res.ok && res.data) {
      setStaffStatus(`Uploaded (SHA-256: ${String(res.data.checksumSha256 || '').slice(0, 12)}…) & logged in Audit Trail.`);
      setStaffFileDataUrl(null);
      setStaffReason('');
      onUploaded?.();
    } else {
      setStaffStatus(res.error || 'Staff upload failed.');
    }
  };

  const currentPhotoState = photos[currentStep.key];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Guided Live Camera Evidence Capture
          </h3>
          <p className="text-xs text-muted-foreground">
            Capture all required vehicle angles directly via your camera. Standard gallery uploads are disabled.
          </p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {completedCount} of {CAPTURE_STEPS.length} photos completed
        </div>
      </div>

      {/* Step progress strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {CAPTURE_STEPS.map((s, idx) => {
          const st = photos[s.key]?.status;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setPendingPreview(null);
                setQualityWarning(null);
                setStepIdx(idx);
              }}
              className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold truncate text-center transition ${
                idx === stepIdx
                  ? 'border-primary bg-primary text-primary-foreground'
                  : st === 'uploaded'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : st === 'failed'
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : 'border-border bg-muted/40 text-muted-foreground'
              }`}
              title={s.title}
            >
              {idx + 1}. {st === 'uploaded' ? '✓' : s.key.split('_')[0]}
            </button>
          );
        })}
      </div>

      {/* Active Instruction Banner */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs">
        <div className="font-bold text-foreground">{currentStep.title}</div>
        <p className="text-muted-foreground mt-0.5">{currentStep.instruction}</p>
      </div>

      {cameraError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}

      {qualityWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{qualityWarning}</span>
        </div>
      )}

      {/* Camera Live Feed OR Preview Before Confirmation */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950 aspect-video max-h-[360px] flex items-center justify-center">
        {pendingPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pendingPreview} alt="Captured preview" className="h-full w-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            {cameraActive && (
              <div className="pointer-events-none absolute inset-5 border-2 border-dashed border-emerald-400/80 rounded-xl flex items-end justify-center pb-2">
                <span className="rounded bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {currentStep.frameHint}
                </span>
              </div>
            )}
            {!cameraActive && (
              <div className="text-center p-6 space-y-3">
                <Camera className="h-10 w-10 text-slate-400 mx-auto" />
                <div className="text-xs text-slate-300">Live camera preview is ready to start</div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Camera className="h-4 w-4" /> Enable Live Camera
                </button>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => {
              setPendingPreview(null);
              setStepIdx((i) => Math.max(0, i - 1));
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            type="button"
            disabled={stepIdx === CAPTURE_STEPS.length - 1}
            onClick={() => {
              setPendingPreview(null);
              setStepIdx((i) => Math.min(CAPTURE_STEPS.length - 1, i + 1));
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!pendingPreview && cameraActive && (
            <button
              type="button"
              onClick={handleCaptureFrame}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" /> Capture Photo
            </button>
          )}

          {pendingPreview && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingPreview(null);
                  setQualityWarning(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retake
              </button>
              <button
                type="button"
                disabled={currentPhotoState?.status === 'uploading'}
                onClick={handleConfirmUpload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {currentPhotoState?.status === 'uploading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{currentPhotoState?.status === 'uploading' ? 'Uploading...' : 'Confirm & Upload'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Per-step status */}
      {currentPhotoState?.status === 'uploaded' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Uploaded &amp; Verified for {currentStep.title}
          </span>
          {currentPhotoState.checksum && (
            <span className="font-mono text-[10px]">SHA-256: {currentPhotoState.checksum.slice(0, 14)}…</span>
          )}
        </div>
      )}
      {currentPhotoState?.status === 'failed' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          Upload failed: {currentPhotoState.error}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Note: Live camera capture discourages casual upload of old gallery photos, and every image receives a server timestamp and SHA-256 checksum, though physical presence still requires adjuster/AI review.
      </p>

      {/* Permission-Gated Staff Exception Upload */}
      <Can permission="claims:update">
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowStaffPanel((v) => !v)}
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1.5"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {showStaffPanel ? 'Hide Staff Exception Upload' : 'Staff Exception Upload (Adjuster Only)'}
          </button>

          {showStaffPanel && (
            <form onSubmit={handleStaffExceptionUpload} className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5 text-xs">
              <div className="font-bold text-foreground">Audited Staff Exception Upload ({currentStep.key})</div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setStaffFileDataUrl(String(reader.result || ''));
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-xs"
              />
              <input
                required
                value={staffReason}
                onChange={(e) => setStaffReason(e.target.value)}
                placeholder="Mandatory audit reason (e.g., Police scene photo received via email)"
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{staffStatus || 'Recorded in ClaimAuditLog'}</span>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-500"
                >
                  Upload Exception
                </button>
              </div>
            </form>
          )}
        </div>
      </Can>
    </div>
  );
}
