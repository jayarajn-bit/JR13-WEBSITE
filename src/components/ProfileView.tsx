import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Save, ShieldCheck } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import { REGULATORY_DISCLOSURE } from '../lib/savingsEngine';
import { getUpiAppOption, isValidUpiVpa, maskUpiVpa, UPI_APPS } from '../lib/upiGateway';
import type { UpiAppId } from '../types/savings';
import type { WorkspaceTab } from './DashboardView';

export function ProfileView({
  onNavigate,
}: {
  onNavigate?: (tab: WorkspaceTab) => void;
}) {
  const { currentUser, currentProfile, currentUid, state, authMode, updateProfile, actionBusy } =
    useSavings();

  const userAccounts = useMemo(
    () =>
      state.paymentAccounts
        .filter((a) => a.userId === currentUid)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    [state.paymentAccounts, currentUid]
  );

  const [fullName, setFullName] = useState(currentProfile?.fullName || '');
  const [phoneMasked, setPhoneMasked] = useState(currentProfile?.phoneMasked || '');
  const [city, setCity] = useState(currentProfile?.city || '');
  const [stateName, setStateName] = useState(currentProfile?.state || '');
  const [preferredStartInr, setPreferredStartInr] = useState(
    currentProfile?.preferredStartInr || 10
  );
  const [preferredIncrementInr, setPreferredIncrementInr] = useState(
    currentProfile?.preferredIncrementInr || 10
  );
  const [preferredUpiApp, setPreferredUpiApp] = useState<UpiAppId>(
    currentProfile?.preferredUpiApp || 'GPAY'
  );
  const [preferredUpiVpaInput, setPreferredUpiVpaInput] = useState(
    currentProfile?.preferredUpiVpaMasked || ''
  );
  const [vpaError, setVpaError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProfile) {
      setFullName(currentProfile.fullName);
      setPhoneMasked(currentProfile.phoneMasked || '');
      setCity(currentProfile.city || '');
      setStateName(currentProfile.state || '');
      setPreferredStartInr(currentProfile.preferredStartInr);
      setPreferredIncrementInr(currentProfile.preferredIncrementInr);
      setPreferredUpiApp(currentProfile.preferredUpiApp || 'GPAY');
      setPreferredUpiVpaInput(currentProfile.preferredUpiVpaMasked || '');
      setVpaError(null);
    }
  }, [currentProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVpaError(null);
    const trimmedVpa = preferredUpiVpaInput.trim();
    let maskedVpaToSave: string | undefined = undefined;
    if (trimmedVpa) {
      if (trimmedVpa === currentProfile?.preferredUpiVpaMasked) {
        maskedVpaToSave = trimmedVpa;
      } else if (!isValidUpiVpa(trimmedVpa)) {
        setVpaError('Enter a valid UPI ID such as name@okicici or number@ybl (or leave blank).');
        return;
      } else {
        maskedVpaToSave = maskUpiVpa(trimmedVpa);
      }
    }

    await updateProfile({
      fullName: fullName.trim() || 'JR13 Saver',
      phoneMasked: phoneMasked.trim(),
      city: city.trim(),
      state: stateName.trim(),
      preferredStartInr: Math.max(10, Number(preferredStartInr) || 10),
      preferredIncrementInr: Math.max(5, Number(preferredIncrementInr) || 10),
      preferredUpiApp,
      ...(maskedVpaToSave ? { preferredUpiVpaMasked: maskedVpaToSave } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          Individual Profile · {authMode === 'firebase' ? 'Google OAuth Verified' : 'Simulated Demo Profile'}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
          Saver Profile & Schedule Defaults
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <h2 className="font-display text-lg font-bold text-slate-50">
            Personal & Schedule Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Registered Email
              </label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16]/60 border border-slate-800 text-sm text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Masked Phone (Privacy-Safe)
              </label>
              <input
                type="text"
                value={phoneMasked}
                onChange={(e) => setPhoneMasked(e.target.value)}
                placeholder="+91 98••••4310"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">State</label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                KYC Simulation Status
              </label>
              <input
                type="text"
                disabled
                value={currentProfile?.kycSimulationStatus || 'SIMULATED_VERIFIED'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16]/60 border border-slate-800 font-mono text-xs text-emerald-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Default Day 1 Deposit (₹)
              </label>
              <input
                type="number"
                min={10}
                max={10000}
                step={5}
                value={preferredStartInr}
                onChange={(e) => setPreferredStartInr(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Default Daily Increment (₹)
              </label>
              <input
                type="number"
                min={5}
                max={5000}
                step={5}
                value={preferredIncrementInr}
                onChange={(e) => setPreferredIncrementInr(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Preferred UPI App (Simulated Checkout)
              </label>
              <select
                value={preferredUpiApp}
                onChange={(e) => setPreferredUpiApp(e.target.value as UpiAppId)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              >
                {UPI_APPS.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Preferred UPI ID / VPA (Stored Masked)
              </label>
              <input
                type="text"
                value={preferredUpiVpaInput}
                onChange={(e) => {
                  setPreferredUpiVpaInput(e.target.value);
                  if (vpaError) setVpaError(null);
                }}
                placeholder="e.g. name@okicici or number@ybl"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
              {vpaError && <p className="text-xs text-red-400 mt-1">{vpaError}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={actionBusy}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] text-sm font-semibold hover:bg-[#E5C158] transition-colors inline-flex items-center gap-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile Settings</span>
          </button>
        </form>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#E5C158]">
                <CreditCard className="w-5 h-5" />
                <h2 className="font-display text-lg font-bold text-slate-50">
                  Registered Payment Accounts
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">{userAccounts.length} linked</span>
            </div>

            {userAccounts.length === 0 ? (
              <p className="text-xs text-slate-400">
                No bank or UPI payment account registered yet.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {userAccounts.slice(0, 3).map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-[#060B16] border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {acc.accountLabel}
                        {acc.isPrimary ? ' · Primary' : ''}
                      </p>
                      <p className="font-mono text-slate-400 truncate mt-0.5">
                        {acc.accountType === 'UPI_VPA'
                          ? `${getUpiAppOption(acc.upiApp).shortCode} · ${acc.upiVpaMasked}`
                          : `${acc.bankName} · ${acc.accountNumberMasked}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#060B16] border border-[#D4AF37]/40 text-xs font-semibold text-[#E5C158] hover:border-[#D4AF37] transition-colors"
              >
                Register or Manage Payment Accounts
              </button>
            )}
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#E5C158]">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="font-display text-lg font-bold text-slate-50">
                Data Privacy & Regulatory Posture
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{REGULATORY_DISCLOSURE}</p>
            <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
              <p>Account UID: <span className="font-mono text-slate-200">{currentUser?.uid}</span></p>
              <p>Provider: <span className="font-mono text-slate-200">{currentUser?.authProvider}</span></p>
              <p>Account Status: <span className="font-mono text-emerald-300">{currentUser?.accountStatus}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
