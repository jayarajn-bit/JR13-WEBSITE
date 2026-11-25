import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Landmark,
  Lock,
  PlusCircle,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import {
  getUpiAppOption,
  INDIAN_BANKS,
  isValidBankAccountNumber,
  isValidIfscCode,
  isValidUpiVpa,
  maskBankAccountNumber,
  maskUpiVpa,
  normalizeIfscCode,
  UPI_APPS,
  UPI_REGULATORY_GATE_NOTICE,
} from '../lib/upiGateway';
import type { PaymentAccountType, UpiAppId } from '../types/savings';

export function PaymentAccountsView() {
  const {
    currentUid,
    currentProfile,
    state,
    actionBusy,
    registerPaymentAccount,
    setPrimaryPaymentAccount,
    removePaymentAccount,
  } = useSavings();

  const userAccounts = useMemo(
    () =>
      state.paymentAccounts
        .filter((a) => a.userId === currentUid)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.createdAt.localeCompare(a.createdAt)),
    [state.paymentAccounts, currentUid]
  );

  const [accountType, setAccountType] = useState<PaymentAccountType>('UPI_VPA');
  const [holderName, setHolderName] = useState(currentProfile?.fullName || '');
  const [accountLabel, setAccountLabel] = useState('');

  const [upiApp, setUpiApp] = useState<UpiAppId>(currentProfile?.preferredUpiApp || 'GPAY');
  const [upiVpa, setUpiVpa] = useState('');

  const [bankName, setBankName] = useState<string>(INDIAN_BANKS[0]);
  const [customBankName, setCustomBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');

  const [setAsPrimary, setSetAsPrimary] = useState(userAccounts.length === 0);
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedBankName = bankName === 'OTHER' ? customBankName.trim() : bankName;
  const normalizedIfsc = normalizeIfscCode(ifscCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanHolder = holderName.trim();
    const cleanLabel =
      accountLabel.trim() ||
      (accountType === 'UPI_VPA'
        ? `${getUpiAppOption(upiApp).name} Account`
        : `${resolvedBankName || 'Bank'} Savings`);

    if (!cleanHolder) {
      setFormError('Account holder name is required (must match your saver profile).');
      return;
    }

    if (accountType === 'UPI_VPA') {
      if (!isValidUpiVpa(upiVpa)) {
        setFormError(
          `Enter a valid NPCI UPI ID such as ${getUpiAppOption(upiApp).sampleHandle}.`
        );
        return;
      }
    } else {
      if (resolvedBankName.length < 2) {
        setFormError('Select or enter your Indian bank name.');
        return;
      }
      if (!isValidIfscCode(normalizedIfsc)) {
        setFormError('Enter a valid 11-character IFSC code (for example, HDFC0000142).');
        return;
      }
      if (!isValidBankAccountNumber(accountNumber)) {
        setFormError('Bank account number must contain 9 to 18 numeric digits.');
        return;
      }
      if (
        accountNumber.replace(/[\s-]+/g, '') !==
        confirmAccountNumber.replace(/[\s-]+/g, '')
      ) {
        setFormError('Account number and confirmation do not match.');
        return;
      }
    }

    try {
      await registerPaymentAccount({
        accountType,
        holderName: cleanHolder,
        accountLabel: cleanLabel,
        upiApp: accountType === 'UPI_VPA' ? upiApp : undefined,
        upiVpa: accountType === 'UPI_VPA' ? upiVpa.trim() : undefined,
        bankName: accountType === 'BANK_ACCOUNT' ? resolvedBankName : undefined,
        ifscCode: accountType === 'BANK_ACCOUNT' ? normalizedIfsc : undefined,
        accountNumber: accountType === 'BANK_ACCOUNT' ? accountNumber : undefined,
        setAsPrimary,
      });
      setAccountLabel('');
      setUpiVpa('');
      setIfscCode('');
      setAccountNumber('');
      setConfirmAccountNumber('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not register payment account.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Payment & Settlement Destinations · Privacy-Masked · Simulated INR Mode
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
            Register Payment Account
          </h1>
        </div>
        <p className="text-xs font-mono text-[#E5C158] shrink-0">
          {userAccounts.length} Registered Account{userAccounts.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Regulatory & Privacy Guardrail Notice */}
      <div className="bg-[#0B1324] border border-[#D4AF37]/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
        <Lock className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-100">
            Privacy Masking & Live Mandate Lock Active
          </p>
          <p>
            Account numbers and UPI VPAs are automatically masked before persistence. No live bank
            mandate, e-NACH, auto-debit, or real-money refund is initiated until Indian legal review
            and an authorized regulated bank/payment partner approve the complete flow.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Registration Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Add UPI or Bank Account
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Simulated Verification</span>
          </div>

          {/* Account Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#060B16] border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAccountType('UPI_VPA');
                setFormError(null);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                accountType === 'UPI_VPA'
                  ? 'bg-[#D4AF37] text-[#060B16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>UPI App / VPA</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType('BANK_ACCOUNT');
                setFormError(null);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                accountType === 'BANK_ACCOUNT'
                  ? 'bg-[#D4AF37] text-[#060B16]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>Indian Bank Account</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Holder Full Name
              </label>
              <input
                type="text"
                required
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="e.g. Arjun Mehta"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Nickname / Label
              </label>
              <input
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder={
                  accountType === 'UPI_VPA' ? 'e.g. GPay Personal' : 'e.g. HDFC Savings'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {accountType === 'UPI_VPA' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  UPI Payment App
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {UPI_APPS.map((app) => {
                    const selected = upiApp === app.id;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setUpiApp(app.id)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs transition-colors ${
                          selected
                            ? 'bg-[#101B33] border-[#D4AF37] text-[#E5C158] font-semibold'
                            : 'bg-[#060B16] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {app.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  UPI ID / VPA
                </label>
                <input
                  type="text"
                  required
                  value={upiVpa}
                  onChange={(e) => {
                    setUpiVpa(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={`e.g. ${getUpiAppOption(upiApp).sampleHandle}`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
                {upiVpa.trim() && isValidUpiVpa(upiVpa) && (
                  <p className="text-[11px] text-emerald-400 font-mono mt-1.5">
                    Valid UPI ID · Stored masked as {maskUpiVpa(upiVpa)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Indian Bank Name
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {INDIAN_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                    <option value="OTHER">Other Indian Scheduled Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    IFSC Code (11 Characters)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => {
                      setIfscCode(e.target.value.toUpperCase());
                      if (formError) setFormError(null);
                    }}
                    placeholder="HDFC0000142"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono uppercase text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                  {ifscCode.trim() && isValidIfscCode(normalizedIfsc) && (
                    <p className="text-[11px] text-emerald-400 font-mono mt-1">
                      Valid IFSC format ({normalizedIfsc})
                    </p>
                  )}
                </div>
              </div>

              {bankName === 'OTHER' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Enter Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    placeholder="e.g. IDFC First Bank"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bank Account Number (9–18 Digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter account number"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Account Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={confirmAccountNumber}
                    onChange={(e) => {
                      setConfirmAccountNumber(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Re-enter account number"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {accountNumber.trim() && isValidBankAccountNumber(accountNumber) && (
                <p className="text-[11px] text-emerald-400 font-mono">
                  Account digits validated · Stored masked as{' '}
                  {maskBankAccountNumber(accountNumber).masked}
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={setAsPrimary}
              onChange={(e) => setSetAsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-[#060B16] accent-[#D4AF37]"
            />
            <span>Set as primary account for simulated UPI deposits & partner settlement previews</span>
          </label>

          {formError && (
            <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-3 text-xs text-red-200">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={actionBusy}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] text-sm font-semibold hover:bg-[#E5C158] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Payment Account (Simulated)</span>
          </button>
        </form>

        {/* Registered Accounts List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-50">
                Registered Payment Accounts
              </h2>
              <span className="text-xs text-slate-400">Owner-Isolated & Masked</span>
            </div>

            {userAccounts.length === 0 ? (
              <div className="bg-[#060B16] border border-slate-800 rounded-xl p-6 text-center space-y-2">
                <p className="text-sm font-medium text-slate-200">
                  No payment account registered yet
                </p>
                <p className="text-xs text-slate-400">
                  Register a Google Pay, PhonePe, Paytm, BHIM UPI ID, or Indian bank account to
                  pre-fill simulated checkouts and record your settlement refund destination.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      acc.isPrimary
                        ? 'bg-[#101B33] border-[#D4AF37]/60'
                        : 'bg-[#060B16] border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {acc.accountType === 'UPI_VPA' ? (
                          <Smartphone className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
                        ) : (
                          <Landmark className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {acc.accountLabel}
                            {acc.isPrimary ? ' · Primary' : ''}
                          </p>
                          <p className="text-xs text-slate-300 font-mono truncate">
                            {acc.accountType === 'UPI_VPA'
                              ? `${getUpiAppOption(acc.upiApp).name} · ${acc.upiVpaMasked}`
                              : `${acc.bankName} · ${acc.accountNumberMasked} · IFSC ${acc.ifscCode}`}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Holder: {acc.holderName} · {acc.verificationStatus} · Simulated Mode
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      {!acc.isPrimary ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => setPrimaryPaymentAccount(acc.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B1324] border border-slate-700 text-xs font-medium text-[#E5C158] hover:border-[#D4AF37] inline-flex items-center gap-1.5"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Set Primary</span>
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 inline-flex items-center gap-1 mr-auto">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Default Checkout & Settlement Account
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => removePaymentAccount(acc.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs font-medium text-red-200 hover:bg-red-950 inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 space-y-2 text-xs text-slate-400 leading-relaxed">
            <div className="flex items-center gap-2 text-[#E5C158]">
              <ShieldCheck className="w-4 h-4" />
              <p className="font-semibold text-slate-100">Regulatory Compliance Note</p>
            </div>
            <p>{UPI_REGULATORY_GATE_NOTICE}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
