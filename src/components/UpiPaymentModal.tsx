import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Lock, QrCode, Smartphone, X } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import { formatINR } from '../lib/savingsEngine';
import {
  buildSimulatedUpiIntentUri,
  generateUpiQrDataUrl,
  getUpiAppOption,
  isValidUpiVpa,
  maskUpiVpa,
  UPI_APPS,
  UPI_REGULATORY_GATE_NOTICE,
} from '../lib/upiGateway';
import type { UpiAppId } from '../types/savings';

interface UpiPaymentModalProps {
  open: boolean;
  dayNumber: number;
  amountInr: number;
  challengeTitle: string;
  defaultApp?: UpiAppId;
  busy?: boolean;
  onClose: () => void;
  onConfirmSimulatedUpi: (payload: { upiApp: UpiAppId; upiVpa?: string }) => Promise<void>;
}

export function UpiPaymentModal({
  open,
  dayNumber,
  amountInr,
  challengeTitle,
  defaultApp = 'GPAY',
  busy = false,
  onClose,
  onConfirmSimulatedUpi,
}: UpiPaymentModalProps) {
  const { currentUid, state } = useSavings();
  const [selectedApp, setSelectedApp] = useState<UpiAppId>(defaultApp);
  const [upiVpa, setUpiVpa] = useState('');
  const [vpaError, setVpaError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUri, setCopiedUri] = useState(false);

  const registeredUpiAccounts = useMemo(
    () =>
      state.paymentAccounts.filter(
        (a) => a.userId === currentUid && a.accountType === 'UPI_VPA'
      ),
    [state.paymentAccounts, currentUid]
  );

  const previewRef = useMemo(() => `SIMUPI-D${dayNumber}-${Date.now().toString(36).slice(-4).toUpperCase()}`, [dayNumber, open]);

  const upiUri = useMemo(
    () =>
      buildSimulatedUpiIntentUri({
        amountInr,
        transactionRef: previewRef,
        note: `JR13 ${challengeTitle} Day ${dayNumber}`,
        appId: selectedApp,
      }),
    [amountInr, previewRef, challengeTitle, dayNumber, selectedApp]
  );

  const wasOpenRef = React.useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedApp(defaultApp);
      setUpiVpa('');
      setVpaError(null);
    }
    wasOpenRef.current = open;
  }, [open, defaultApp]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    generateUpiQrDataUrl(upiUri)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [open, upiUri]);

  if (!open) return null;

  const selectedOption = getUpiAppOption(selectedApp);

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(upiUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      setCopiedUri(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVpaError(null);
    const trimmed = upiVpa.trim();
    if (trimmed && !isValidUpiVpa(trimmed)) {
      setVpaError(`Enter a valid UPI ID such as ${selectedOption.sampleHandle} (or leave blank for app intent).`);
      return;
    }
    await onConfirmSimulatedUpi({
      upiApp: selectedApp,
      upiVpa: trimmed || undefined,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upi-checkout-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-xl bg-[#0B1324] border border-slate-800 rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#E5C158]">
              Simulated NPCI UPI Checkout · Day {dayNumber} · {challengeTitle}
            </p>
            <h2 id="upi-checkout-title" className="font-display text-lg font-bold text-slate-50 mt-0.5">
              Pay {formatINR(amountInr)} via UPI App
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close UPI checkout"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#060B16] border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {registeredUpiAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">
                Quick-Select Registered UPI Account
              </p>
              <div className="flex flex-wrap gap-2">
                {registeredUpiAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      if (acc.upiApp) setSelectedApp(acc.upiApp);
                      setVpaError(null);
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs text-left transition-colors ${
                      selectedApp === acc.upiApp
                        ? 'bg-[#101B33] border-[#D4AF37] text-[#E5C158]'
                        : 'bg-[#060B16] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{acc.accountLabel}</span>{' '}
                    <span className="font-mono text-slate-400">({acc.upiVpaMasked})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* App Grid */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Select UPI Payment App (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, or Any UPI)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {UPI_APPS.map((app) => {
                const active = selectedApp === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedApp(app.id)}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-left transition-colors flex items-center gap-2.5 ${
                      active
                        ? 'bg-[#101B33] border-[#D4AF37] text-[#E5C158]'
                        : 'bg-[#060B16] border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{app.name}</p>
                      <p className="text-[10px] text-slate-400 truncate font-mono">
                        {app.sampleHandle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional VPA Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Optional UPI ID / VPA for {selectedOption.name} (Masked in Ledger)
            </label>
            <input
              type="text"
              value={upiVpa}
              onChange={(e) => {
                setUpiVpa(e.target.value);
                if (vpaError) setVpaError(null);
              }}
              placeholder={`e.g. ${selectedOption.sampleHandle}`}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
            />
            {vpaError ? (
              <p className="text-xs text-red-400">{vpaError}</p>
            ) : upiVpa.trim() && isValidUpiVpa(upiVpa) ? (
              <p className="text-[11px] text-emerald-400 font-mono">
                Valid VPA · Stored masked as {maskUpiVpa(upiVpa)}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Leave empty to use simulated app-intent flow via {selectedOption.name}.
              </p>
            )}
          </div>

          {/* Sandbox QR + Intent URI Preview */}
          <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-28 h-28 rounded-xl bg-slate-50 p-1.5 shrink-0 flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Simulated UPI sandbox QR preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-8 h-8 text-slate-700" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-xs">
              <p className="font-semibold text-slate-100">
                Sandbox NPCI Intent URI ({selectedOption.shortCode})
              </p>
              <p className="font-mono text-[11px] text-slate-400 break-all line-clamp-2">
                {upiUri}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0B1324] border border-slate-700 text-[11px] text-slate-200 hover:border-[#D4AF37] inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedUri ? 'Copied URI' : 'Copy Sandbox URI'}</span>
                </button>
                <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#E5C158]" /> Live debit disabled
                </span>
              </div>
            </div>
          </div>

          {/* Regulatory Notice */}
          <div className="bg-[#060B16] border border-[#D4AF37]/30 rounded-xl p-3.5 text-[11px] text-slate-300 leading-relaxed">
            {UPI_REGULATORY_GATE_NOTICE}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#060B16] border border-slate-700 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] text-sm font-semibold hover:bg-[#E5C158] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Simulate {selectedOption.name} Payment ({formatINR(amountInr)})
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
