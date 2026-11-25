import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useSavings } from '../context/SavingsContext';
import { CHALLENGE_PLANS, calculateTotalPlannedInr, formatINR, REGULATORY_DISCLOSURE } from '../lib/savingsEngine';
import HERO_IMG from '../assets/images/hero_vault_monolith_1795576641607.jpg';

export function AuthPortal({ onNavigateWorkspace }: { onNavigateWorkspace?: () => void }) {
  const { signInWithGoogle, enterDemoSession, registerDemoAccount, actionBusy, statusBanner } =
    useSavings();

  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [imgFailed, setImgFailed] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerDemoAccount(fullName, email, city, stateName);
    onNavigateWorkspace?.();
  };

  const handleDemoStart = (role: 'saver' | 'saver2' | 'admin') => {
    enterDemoSession(role);
    onNavigateWorkspace?.();
  };

  return (
    <div className="min-h-screen bg-[#060B16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-slate-800/80 bg-[#060B16]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#E5C158] whitespace-nowrap shrink-0"
          >
            JR13 SAVINGS
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#challenges" className="hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0">
              Challenges
            </a>
            <a href="#safeguards" className="hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0">
              Safeguards
            </a>
            <a href="#access" className="hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0">
              Demo Access
            </a>
            <a href="#disclosure" className="hover:text-[#E5C158] transition-colors whitespace-nowrap shrink-0">
              Disclosures
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                const ok = await signInWithGoogle();
                if (ok) onNavigateWorkspace?.();
              }}
              className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#060B16] text-xs font-semibold hover:bg-[#E5C158] transition-colors whitespace-nowrap shrink-0 min-h-[40px] disabled:opacity-60"
            >
              Sign In with Google
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section id="top" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:col-span-7 flex flex-col justify-between bg-[#0B1324] border border-slate-800/90 rounded-2xl overflow-hidden"
            >
              <div className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden bg-[#03060D]">
                {!imgFailed ? (
                  <img
                    src={HERO_IMG}
                    alt="JR13 SAVINGS obsidian and brushed gold vault architecture"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B1324] via-[#060B16] to-[#1A1405] flex items-center justify-center">
                    <ShieldCheck className="w-12 h-12 text-[#D4AF37]/70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1324] via-[#0B1324]/45 to-transparent" />
              </div>

              <div className="p-6 sm:p-8 space-y-5 -mt-10 relative z-10">
                <p className="text-xs font-medium tracking-wide text-[#E5C158]">
                  Live Firebase Auth &amp; Firestore Workspace · Simulated INR Payment Ledger
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-50 text-balance leading-[1.12]">
                  Save Daily. Build Your Future.
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                  Commit to progressive daily ₹ deposits starting from ₹10 on Day 1, ₹20 on Day 2,
                  and ₹30 on Day 3. Track daily streaks, inspect every rupee of your schedule before
                  enrolling, and rely on a non-confiscatable restricted ledger if a deadline is
                  missed.
                </p>

                <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80">
                  <div>
                    <p className="text-xs text-slate-400">Day 1 Default</p>
                    <p className="font-mono text-lg font-semibold text-slate-100 tabular-nums mt-0.5">
                      ₹10
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Daily Step</p>
                    <p className="font-mono text-lg font-semibold text-slate-100 tabular-nums mt-0.5">
                      +₹10/day
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Challenge Tiers</p>
                    <p className="font-mono text-lg font-semibold text-slate-100 tabular-nums mt-0.5">
                      1–364 Days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Forfeiture Policy</p>
                    <p className="font-mono text-lg font-semibold text-[#E5C158] tabular-nums mt-0.5">
                      0% Prohibited
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Auth & Demo Access Card */}
            <div
              id="access"
              className="lg:col-span-5 bg-[#0B1324] border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-xl font-bold text-slate-50">
                    Account & Demo Portal
                  </h2>
                  <div className="flex items-center gap-1 p-1 bg-[#060B16] border border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTab('signin')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        tab === 'signin'
                          ? 'bg-[#D4AF37] text-[#060B16]'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('register')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        tab === 'register'
                          ? 'bg-[#D4AF37] text-[#060B16]'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Register
                    </button>
                  </div>
                </div>

                {statusBanner && (
                  <div
                    role="status"
                    className={`rounded-xl p-3 text-xs border ${
                      statusBanner.type === 'error'
                        ? 'bg-red-950/50 border-red-500/40 text-red-200'
                        : 'bg-slate-900 border-[#D4AF37]/30 text-slate-200'
                    }`}
                  >
                    {statusBanner.text}
                  </div>
                )}

                {tab === 'signin' ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={async () => {
                        const ok = await signInWithGoogle();
                        if (ok) onNavigateWorkspace?.();
                      }}
                      className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <span>Continue with Google OAuth (Live Account)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="h-px flex-1 bg-slate-800" />
                      <span>Or explore simulated demo accounts</span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => handleDemoStart('saver')}
                        className="w-full min-h-[44px] text-left px-4 py-3 rounded-xl bg-[#060B16] border border-slate-800 hover:border-[#D4AF37]/50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            Arjun Mehta — Demo Saver
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            arjun.mehta@demo.jr13.in · Active 99d + Restricted ₹1,200
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#E5C158] shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDemoStart('saver2')}
                        className="w-full min-h-[44px] text-left px-4 py-3 rounded-xl bg-[#060B16] border border-slate-800 hover:border-[#D4AF37]/50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            Priya Nair — Demo Saver
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            priya.nair@demo.jr13.in · Active 364d + Settled Refund
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#E5C158] shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDemoStart('admin')}
                        className="w-full min-h-[44px] text-left px-4 py-3 rounded-xl bg-[#060B16] border border-slate-800 hover:border-[#D4AF37]/50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            Kavita Deshmukh — Compliance Admin
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            compliance.admin@demo.jr13.in · Ledger Reconciliation & Audit
                          </p>
                        </div>
                        <Lock className="w-4 h-4 text-[#E5C158] shrink-0" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Siddharth Verma"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="siddharth@example.in"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[44px] px-4 py-3 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create Demo Saver Profile</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                Sign in with Google OAuth to save challenges and streaks to live Firestore. Real-money
                INR debit remains disabled until regulatory and banking partner approval.
              </div>
            </div>
          </div>
        </section>

        {/* Challenge Tiers Strip */}
        <section
          id="challenges"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-900"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-50">
                Proposed Savings Challenge Tiers
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Default ₹10 Day 1 + ₹10 daily increment · Bonus calculated once on completion:
                eligible savings × rate / 100
              </p>
            </div>
            <p className="text-xs text-[#E5C158]">
              Illustrative proposed rates only — not guaranteed returns
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CHALLENGE_PLANS.map((plan) => {
              const defaultPlanned = calculateTotalPlannedInr(plan.durationDays, 10, 10);
              const bonus = (defaultPlanned * plan.illustrativeBonusRate) / 100;
              return (
                <div
                  key={plan.code}
                  className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <p className="text-xs text-slate-400">
                      {plan.durationDays} {plan.durationDays === 1 ? 'Day' : 'Days'} · {plan.targetAudience}
                    </p>
                    <h3 className="font-display text-lg font-bold text-slate-50 mt-1">
                      {plan.title}
                    </h3>
                    <p className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums mt-3">
                      {plan.illustrativeBonusRate === 0 ? '1 Streak' : `${plan.illustrativeBonusRate}%`}{' '}
                      <span className="text-xs font-sans font-normal text-slate-400">
                        {plan.illustrativeBonusRate === 0 ? '1-day only' : 'illustrative bonus'}
                      </span>
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Default Total Planned</span>
                      <span className="font-mono tabular-nums">{formatINR(defaultPlanned)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Proposed 1x Bonus</span>
                      <span className="font-mono tabular-nums text-[#E5C158]">
                        {plan.illustrativeBonusRate === 0 ? '₹0 (1-Day)' : formatINR(bonus)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Safeguards & Regulatory Disclosure */}
        <section
          id="safeguards"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-900"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#E5C158]">
                <CheckCircle2 className="w-4 h-4" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Zero Forfeiture Policy
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Missing a daily deadline locks the challenge and blocks further deposits, while
                preserving 100% of customer principal in a separate Restricted Funds Ledger.
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#E5C158]">
                <Lock className="w-4 h-4" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Admin Spend Prohibited
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Administrators can only view and reconcile restricted ledger records. Spending,
                withdrawal, reallocation, or forfeiture is blocked at both API and rule layers.
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#E5C158]">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Regulated Partner Gate
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Refund settlements require documented Indian legal review and regulated banking or
                payment partner approval references with an immutable audit trail.
              </p>
            </div>
          </div>
        </section>

        <section
          id="disclosure"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10"
        >
          <div className="bg-[#0B1324] border border-[#D4AF37]/30 rounded-2xl p-5 text-xs text-slate-300 leading-relaxed">
            <strong className="text-[#E5C158]">Regulatory & Simulation Disclosure:</strong>{' '}
            {REGULATORY_DISCLOSURE}
          </div>
        </section>
      </main>
    </div>
  );
}
