import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Flame, Lock, Smartphone } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import {
  formatINR,
  formatRemainingCooldown,
  generateFullSchedule,
  getChallengeDescription,
  getChallengeFailureCause,
  getDayAmountInr,
  getPlanByCode,
  getUserStreakCooldown,
  MISSED_DEADLINE_CAUSES,
} from '../lib/savingsEngine';
import { getUpiAppOption } from '../lib/upiGateway';
import type { WorkspaceTab } from './DashboardView';
import { UpiPaymentModal } from './UpiPaymentModal';

export function CalendarStreakView({
  onNavigate,
}: {
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const {
    currentUid,
    currentProfile,
    state,
    recordDailyContribution,
    simulateMissedDeadline,
    actionBusy,
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
    () =>
      state.challenges
        .filter((c) => c.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.challenges, currentUid]
  );

  const [selectedId, setSelectedId] = useState<string>(userChallenges[0]?.id || '');
  const selectedChallenge =
    userChallenges.find((c) => c.id === selectedId) || userChallenges[0] || null;

  const contributions = useMemo(
    () =>
      selectedChallenge
        ? state.dailyContributions.filter((d) => d.challengeId === selectedChallenge.id)
        : [],
    [state.dailyContributions, selectedChallenge]
  );

  const streak = selectedChallenge
    ? state.streaks.find((s) => s.challengeId === selectedChallenge.id)
    : null;

  const schedule = useMemo(() => {
    if (!selectedChallenge) return [];
    return generateFullSchedule(
      selectedChallenge.durationDays,
      selectedChallenge.startAmountInr,
      selectedChallenge.incrementAmountInr,
      selectedChallenge.startDate
    );
  }, [selectedChallenge]);

  const paidByDay = useMemo(() => {
    const map = new Map<number, (typeof contributions)[0]>();
    contributions.forEach((c) => map.set(c.dayNumber, c));
    return map;
  }, [contributions]);

  if (!selectedChallenge) {
    return (
      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <h1 className="font-display text-xl font-bold text-slate-50">
          Daily Savings Calendar
        </h1>
        <p className="text-sm text-slate-400">
          Enroll in a savings challenge to track your daily calendar and streak progression.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('challenges')}
          className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm"
        >
          Browse Challenges
        </button>
      </div>
    );
  }

  const nextDay = selectedChallenge.completedDays + 1;
  const nextAmount = getDayAmountInr(
    nextDay,
    selectedChallenge.startAmountInr,
    selectedChallenge.incrementAmountInr
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Daily Savings Calendar & Streak Tracker
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
            {getPlanByCode(selectedChallenge.planCode).title} ({selectedChallenge.durationDays} Days)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {userChallenges.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                c.id === selectedChallenge.id
                  ? 'bg-[#D4AF37] text-[#060B16] border-[#D4AF37]'
                  : 'bg-[#0B1324] text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {c.durationDays}d · {c.status}
            </button>
          ))}
        </div>
      </div>

      {/* Streak & Action Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Current Streak</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums">
              {streak?.currentStreak ?? 0} Days
            </span>
            <Flame className="w-4 h-4 text-[#E5C158]" />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Longest: {streak?.longestStreak ?? 0} days ·{' '}
            {streak?.streakBroken ? 'Streak broken on missed deadline' : 'Active streak'}
          </p>
        </div>

        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400">Challenge Progress</p>
          <p className="font-mono text-2xl font-bold text-slate-50 tabular-nums mt-1">
            {selectedChallenge.completedDays} / {selectedChallenge.durationDays}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            Saved: <span className="font-mono">{formatINR(selectedChallenge.totalSavedInr)}</span> of{' '}
            <span className="font-mono">{formatINR(selectedChallenge.totalPlannedInr)}</span>
          </p>
        </div>

        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-3">
          {selectedChallenge.status === 'ACTIVE' && !selectedChallenge.locked ? (
            <>
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  Next due: <strong className="text-slate-100">Day {nextDay}</strong> (
                  <span className="font-mono text-[#E5C158]">{formatINR(nextAmount)}</span>) on{' '}
                  <span className="font-mono">{selectedChallenge.nextDueDate}</span>
                </div>
                {streakCooldown.isLocked && streakCooldown.nextUnlockAt && (
                  <p className="text-[11px] text-[#E5C158] font-mono tabular-nums">
                    24h Cooldown: Next streak opens in{' '}
                    {formatRemainingCooldown(streakCooldown.remainingMs)} (
                    {new Date(streakCooldown.nextUnlockAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    )
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionBusy || streakCooldown.isLocked}
                  onClick={() => setUpiModalOpen(true)}
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#D4AF37] text-[#060B16] text-xs font-semibold hover:bg-[#E5C158] transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {streakCooldown.isLocked ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">
                        {formatRemainingCooldown(streakCooldown.remainingMs)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Pay Day {nextDay} via UPI</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setMissFormOpen((prev) => !prev)}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-medium hover:bg-red-950 transition-colors inline-flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Miss Deadline</span>
                </button>
              </div>
              {missFormOpen && (
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <select
                    value={missCause}
                    onChange={(e) => {
                      const nextLabel = e.target.value;
                      setMissCause(nextLabel);
                      const found = MISSED_DEADLINE_CAUSES.find((c) => c.label === nextLabel);
                      if (found) setMissDescription(found.description);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#060B16] border border-slate-800 text-slate-100"
                  >
                    {MISSED_DEADLINE_CAUSES.map((c) => (
                      <option key={c.code} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    maxLength={160}
                    value={missDescription}
                    onChange={(e) => setMissDescription(e.target.value)}
                    placeholder="Description..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#060B16] border border-slate-800 text-slate-100"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMissFormOpen(false)}
                      className="px-2.5 py-1 rounded bg-[#060B16] text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={async () => {
                        await simulateMissedDeadline(selectedChallenge.id, missCause, missDescription);
                        setMissFormOpen(false);
                      }}
                      className="px-2.5 py-1 rounded bg-red-600/80 text-white font-semibold"
                    >
                      Confirm Lock
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2.5 text-xs">
              <Lock className="w-4 h-4 text-[#E5C158] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-100">
                  Challenge {selectedChallenge.status} (Locked)
                </p>
                <p className="text-slate-300">{getChallengeDescription(selectedChallenge)}</p>
                <p className="text-slate-400">
                  {selectedChallenge.status === 'FAILED'
                    ? `Cause: ${getChallengeFailureCause(selectedChallenge.failedReason)}`
                    : 'All scheduled days completed. One-time illustrative bonus recorded.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-50">
            Schedule Grid ({schedule.length} Days)
          </h2>
          <p className="text-xs text-slate-400">
            Paid (Gold/Emerald) · Next Due (Outlined Gold) · Missed/Locked (Red) · Upcoming (Slate)
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {schedule.map((item) => {
            const paid = paidByDay.get(item.dayNumber);
            const isNext =
              selectedChallenge.status === 'ACTIVE' &&
              item.dayNumber === selectedChallenge.completedDays + 1;
            const isMissedCutoff =
              selectedChallenge.status === 'FAILED' &&
              item.dayNumber === selectedChallenge.completedDays + 1;

            let cardStyle = 'bg-[#060B16] border-slate-800 text-slate-400';
            let statusLabel = 'Upcoming';
            if (paid) {
              cardStyle = 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200';
              statusLabel = 'Paid';
            } else if (isMissedCutoff) {
              cardStyle = 'bg-red-950/40 border-red-500/50 text-red-200';
              statusLabel = 'Missed';
            } else if (isNext) {
              cardStyle = 'bg-[#101B33] border-[#D4AF37] text-[#E5C158]';
              statusLabel = 'Due Next';
            } else if (selectedChallenge.locked && !paid) {
              cardStyle = 'bg-[#060B16]/60 border-slate-800/60 text-slate-500';
              statusLabel = 'Locked';
            }

            return (
              <div
                key={item.dayNumber}
                className={`rounded-xl border p-2.5 space-y-1 text-xs ${cardStyle}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold tabular-nums">D{item.dayNumber}</span>
                  <span className="text-[10px]">{statusLabel}</span>
                </div>
                <p className="font-mono text-sm font-bold tabular-nums text-slate-100">
                  {formatINR(item.amountInr)}
                </p>
                <p className="font-mono text-[10px] text-slate-400 tabular-nums truncate">
                  {item.scheduledDate}
                  {paid?.upiApp ? ` · ${getUpiAppOption(paid.upiApp).shortCode}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {selectedChallenge.status === 'ACTIVE' && !selectedChallenge.locked && (
        <UpiPaymentModal
          open={upiModalOpen}
          dayNumber={nextDay}
          amountInr={nextAmount}
          challengeTitle={getPlanByCode(selectedChallenge.planCode).title}
          defaultApp={currentProfile?.preferredUpiApp || 'GPAY'}
          busy={actionBusy}
          onClose={() => setUpiModalOpen(false)}
          onConfirmSimulatedUpi={(payload) =>
            recordDailyContribution(selectedChallenge.id, payload)
          }
        />
      )}
    </div>
  );
}
