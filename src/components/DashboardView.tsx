import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Flame,
  Lock,
  PlusCircle,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import {
  calculateIllustrativeBonusInr,
  formatINR,
  formatRemainingCooldown,
  getChallengeDescription,
  getDayAmountInr,
  getPlanByCode,
  getUserStreakCooldown,
  MISSED_DEADLINE_CAUSES,
  REGULATORY_DISCLOSURE,
} from '../lib/savingsEngine';
import { getUpiAppOption } from '../lib/upiGateway';
import { UpiPaymentModal } from './UpiPaymentModal';

export type WorkspaceTab =
  | 'dashboard'
  | 'challenges'
  | 'calendar'
  | 'ledger'
  | 'accounts'
  | 'notifications'
  | 'profile'
  | 'admin';

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const {
    currentUid,
    currentProfile,
    state,
    actionBusy,
    recordDailyContribution,
    simulateMissedDeadline,
  } = useSavings();
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [missFormOpen, setMissFormOpen] = useState(false);
  const [missCause, setMissCause] = useState(MISSED_DEADLINE_CAUSES[0].label);
  const [missDescription, setMissDescription] = useState(MISSED_DEADLINE_CAUSES[0].description);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const streakCooldown = useMemo(
    () => getUserStreakCooldown(state.dailyContributions, currentUid, nowMs),
    [state.dailyContributions, currentUid, nowMs]
  );

  useEffect(() => {
    if (!streakCooldown.isLocked) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [streakCooldown.isLocked]);

  const userChallenges = useMemo(
    () => state.challenges.filter((c) => c.userId === currentUid),
    [state.challenges, currentUid]
  );

  const activeChallenges = userChallenges.filter((c) => c.status === 'ACTIVE');
  const primaryChallenge = activeChallenges[0] || userChallenges[0] || null;

  const userRestricted = useMemo(
    () =>
      state.restrictedFundsLedger.filter(
        (r) => r.userId === currentUid && r.ownershipStatus === 'USER_OWNED_RESTRICTED'
      ),
    [state.restrictedFundsLedger, currentUid]
  );

  const totalActiveSaved = activeChallenges.reduce((sum, c) => sum + c.totalSavedInr, 0);
  const totalRestrictedBalance = userRestricted.reduce(
    (sum, r) => sum + r.principalBalanceInr,
    0
  );

  const primaryStreak = primaryChallenge
    ? state.streaks.find((s) => s.challengeId === primaryChallenge.id)
    : null;

  const nextDayNumber = primaryChallenge ? primaryChallenge.completedDays + 1 : 0;
  const nextDepositAmount =
    primaryChallenge && primaryChallenge.status === 'ACTIVE'
      ? getDayAmountInr(
          nextDayNumber,
          primaryChallenge.startAmountInr,
          primaryChallenge.incrementAmountInr
        )
      : 0;

  const progressPct = primaryChallenge
    ? Math.min(100, Math.round((primaryChallenge.completedDays / primaryChallenge.durationDays) * 100))
    : 0;

  const projectedBonus = primaryChallenge
    ? calculateIllustrativeBonusInr(
        primaryChallenge.totalPlannedInr,
        primaryChallenge.illustrativeBonusRate
      )
    : 0;

  const recentTx = useMemo(
    () =>
      state.transactions
        .filter((t) => t.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [state.transactions, currentUid]
  );

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Saver Dashboard · {currentProfile?.city || 'India'} · Simulated INR Ledger
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
            Welcome back, {currentProfile?.fullName || 'Saver'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('challenges')}
          className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Start New Challenge</span>
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Active Simulated Savings</p>
          <p className="font-mono text-2xl font-bold text-slate-50 tabular-nums mt-1.5">
            {formatINR(totalActiveSaved)}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {activeChallenges.length} active challenge{activeChallenges.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Current Daily Streak</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums">
              {primaryStreak?.currentStreak ?? 0} Days
            </p>
            <Flame className="w-4 h-4 text-[#E5C158]" />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Best streak: <span className="font-mono tabular-nums">{primaryStreak?.longestStreak ?? 0}</span> days
          </p>
        </div>

        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Projected Illustrative Bonus</p>
          <p className="font-mono text-2xl font-bold text-slate-50 tabular-nums mt-1.5">
            {formatINR(projectedBonus)}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {primaryChallenge
              ? `${primaryChallenge.illustrativeBonusRate}% proposed on completion`
              : 'Select a challenge to preview'}
          </p>
        </div>

        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Restricted Funds (User-Owned)</p>
          <p className="font-mono text-2xl font-bold text-amber-300 tabular-nums mt-1.5">
            {formatINR(totalRestrictedBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {userRestricted.length > 0
              ? 'Pending legal/partner review'
              : 'No failed-challenge holds'}
          </p>
        </div>
      </div>

      {/* Dominant Focal Anchor: Primary Challenge Action & Progress */}
      {primaryChallenge ? (
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400">
                {getPlanByCode(primaryChallenge.planCode).title} · {primaryChallenge.durationDays}{' '}
                {primaryChallenge.durationDays === 1 ? 'Day' : 'Days'} ·{' '}
                {primaryChallenge.illustrativeBonusRate === 0
                  ? '1-Day Single Streak'
                  : `${primaryChallenge.illustrativeBonusRate}% Illustrative Rate`}{' '}
                · Status:{' '}
                <span
                  className={
                    primaryChallenge.status === 'ACTIVE'
                      ? 'text-emerald-400 font-medium'
                      : primaryChallenge.status === 'COMPLETED'
                        ? 'text-[#E5C158] font-medium'
                        : 'text-red-400 font-medium'
                  }
                >
                  {primaryChallenge.status}
                </span>
              </p>
              <h2 className="font-display text-xl font-bold text-slate-50 mt-1">
                Day {primaryChallenge.completedDays} of {primaryChallenge.durationDays} Completed
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="px-4 py-2.5 rounded-xl bg-[#060B16] border border-slate-700 text-slate-200 text-sm font-medium hover:border-[#D4AF37]/50 transition-colors inline-flex items-center gap-2 min-h-[44px]"
              >
                <CalendarDays className="w-4 h-4 text-[#E5C158]" />
                <span>View Calendar</span>
              </button>

              {primaryChallenge.status === 'ACTIVE' && !primaryChallenge.locked && (
                <>
                  <button
                    type="button"
                    disabled={actionBusy || streakCooldown.isLocked}
                    onClick={() => setUpiModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] text-sm font-semibold hover:bg-[#E5C158] transition-colors inline-flex items-center gap-2 min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {streakCooldown.isLocked ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span className="font-mono tabular-nums">
                          Next Streak in {formatRemainingCooldown(streakCooldown.remainingMs)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>
                          Pay Day {nextDayNumber} via UPI ({formatINR(nextDepositAmount)})
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => setMissFormOpen((prev) => !prev)}
                    className="px-4 py-2.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-medium hover:bg-red-950 transition-colors inline-flex items-center gap-1.5 min-h-[44px] disabled:opacity-60"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Simulate Missed Deadline</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {primaryChallenge.status === 'ACTIVE' && !primaryChallenge.locked && (
            <p className="text-xs text-slate-400">
              Description: <span className="text-slate-300">{getChallengeDescription(primaryChallenge)}</span>
            </p>
          )}

          {missFormOpen && primaryChallenge.status === 'ACTIVE' && !primaryChallenge.locked && (
            <div className="bg-[#060B16] border border-red-500/30 rounded-xl p-4 space-y-3 text-xs">
              <p className="font-semibold text-red-300">
                Record Missed Deadline Cause &amp; Description
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Cause</label>
                  <select
                    value={missCause}
                    onChange={(e) => {
                      const nextLabel = e.target.value;
                      setMissCause(nextLabel);
                      const found = MISSED_DEADLINE_CAUSES.find((c) => c.label === nextLabel);
                      if (found) setMissDescription(found.description);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {MISSED_DEADLINE_CAUSES.map((c) => (
                      <option key={c.code} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Description</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={missDescription}
                    onChange={(e) => setMissDescription(e.target.value)}
                    placeholder="Enter description for the missed streak/deadline..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMissFormOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#0B1324] border border-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={async () => {
                    await simulateMissedDeadline(primaryChallenge.id, missCause, missDescription);
                    setMissFormOpen(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600/80 text-white font-semibold hover:bg-red-600 disabled:opacity-60"
                >
                  Confirm Missed Deadline &amp; Lock
                </button>
              </div>
            </div>
          )}

          {primaryChallenge.status === 'ACTIVE' &&
            !primaryChallenge.locked &&
            streakCooldown.isLocked &&
            streakCooldown.nextUnlockAt && (
              <div className="bg-[#060B16] border border-[#D4AF37]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#E5C158] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-100">
                      Daily Streak Limit Reached (1 Streak per 24 Hours)
                    </p>
                    <p className="text-slate-400">
                      Today&apos;s streak is recorded. Your next streak unlocks after 24 hours at{' '}
                      <span className="font-mono text-slate-200">
                        {new Date(streakCooldown.nextUnlockAt).toLocaleString('en-IN')}
                      </span>
                      .
                    </p>
                  </div>
                </div>
                <span className="font-mono font-semibold text-[#E5C158] tabular-nums whitespace-nowrap shrink-0">
                  {formatRemainingCooldown(streakCooldown.remainingMs)} remaining
                </span>
              </div>
            )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Saved:{' '}
                <strong className="font-mono text-slate-100 tabular-nums">
                  {formatINR(primaryChallenge.totalSavedInr)}
                </strong>{' '}
                / {formatINR(primaryChallenge.totalPlannedInr)} planned
              </span>
              <span className="font-mono text-[#E5C158] font-semibold tabular-nums">
                {progressPct}%
              </span>
            </div>
            <div className="h-3 w-full bg-[#060B16] border border-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#A88922] to-[#E5C158] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {primaryChallenge.status === 'FAILED' && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-200 space-y-1">
                  <p className="font-semibold text-red-300">
                    Challenge Locked — Missed Deadline Recorded
                  </p>
                  <p className="text-slate-300">{primaryChallenge.failedReason}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('ledger')}
                className="px-3.5 py-2 rounded-lg bg-[#060B16] border border-slate-700 text-xs font-medium text-[#E5C158] hover:border-[#D4AF37] whitespace-nowrap shrink-0"
              >
                View Restricted Ledger
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <h2 className="font-display text-xl font-bold text-slate-50">
            No Savings Challenge Started Yet
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Preview the full progressive INR deposit schedule (starting at ₹10/day) and enroll in a
            1, 49, 99, 299, or 364-day challenge.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('challenges')}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors min-h-[44px]"
          >
            Choose a Challenge
          </button>
        </div>
      )}

      {/* Recent Transactions & Restricted Ledger Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Recent Simulated Ledger Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="text-xs font-medium text-[#E5C158] hover:underline inline-flex items-center gap-1"
            >
              <span>All Transactions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTx.length === 0 ? (
            <p className="text-sm text-slate-400 py-6">
              No simulated transactions yet. Record your first daily deposit to populate the ledger.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentTx.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                      {tx.referenceId} · {tx.createdAt.slice(0, 10)} · {tx.reconciliationStatus}
                      {tx.upiApp ? ` · ${getUpiAppOption(tx.upiApp).shortCode}` : ''}
                      {tx.upiVpaMasked ? ` (${tx.upiVpaMasked})` : ''}
                    </p>
                  </div>
                  <p className="font-mono font-semibold text-[#E5C158] tabular-nums shrink-0">
                    {formatINR(tx.amountInr)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#0B1324] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert className="w-4 h-4" />
              <h2 className="font-display text-lg font-bold text-slate-50">
                Customer Ownership & Simulation Notice
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{REGULATORY_DISCLOSURE}</p>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Restricted entries: <strong className="text-slate-100">{userRestricted.length}</strong>
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="text-slate-300 hover:text-[#E5C158] font-medium hover:underline"
              >
                Register Payment Account
              </button>
              <button
                type="button"
                onClick={() => onNavigate('ledger')}
                className="text-[#E5C158] font-medium hover:underline"
              >
                View Settlement History
              </button>
            </div>
          </div>
        </div>
      </div>

      {primaryChallenge && primaryChallenge.status === 'ACTIVE' && !primaryChallenge.locked && (
        <UpiPaymentModal
          open={upiModalOpen}
          dayNumber={nextDayNumber}
          amountInr={nextDepositAmount}
          challengeTitle={getPlanByCode(primaryChallenge.planCode).title}
          defaultApp={currentProfile?.preferredUpiApp || 'GPAY'}
          busy={actionBusy}
          onClose={() => setUpiModalOpen(false)}
          onConfirmSimulatedUpi={(payload) =>
            recordDailyContribution(primaryChallenge.id, payload)
          }
        />
      )}
    </div>
  );
}
