import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Info, Search } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import {
  calculateIllustrativeBonusInr,
  calculateTotalPlannedInr,
  CHALLENGE_PLANS,
  formatINR,
  generateFullSchedule,
  getPlanByCode,
} from '../lib/savingsEngine';
import type { PlanCode } from '../types/savings';
import type { WorkspaceTab } from './DashboardView';

const GOLD_LEDGER_IMG = '/src/assets/images/card_gold_ledger_1795576641026.jpg';

export function ChallengeSelectorView({
  onEnrolled,
}: {
  onEnrolled: (tab: WorkspaceTab) => void;
}) {
  const { currentProfile, startChallenge, actionBusy } = useSavings();

  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('1D_0PCT');
  const [startAmountInr, setStartAmountInr] = useState<number>(
    currentProfile?.preferredStartInr || 10
  );
  const [incrementAmountInr, setIncrementAmountInr] = useState<number>(
    currentProfile?.preferredIncrementInr || 10
  );
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [daySearch, setDaySearch] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const plan = getPlanByCode(selectedPlan);

  const safeStart = Math.max(10, Number(startAmountInr) || 10);
  const safeIncrement = Math.max(5, Number(incrementAmountInr) || 10);

  const totalPlannedInr = useMemo(
    () => calculateTotalPlannedInr(plan.durationDays, safeStart, safeIncrement),
    [plan.durationDays, safeStart, safeIncrement]
  );

  const illustrativeBonusInr = useMemo(
    () => calculateIllustrativeBonusInr(totalPlannedInr, plan.illustrativeBonusRate),
    [totalPlannedInr, plan.illustrativeBonusRate]
  );

  const fullSchedule = useMemo(
    () => generateFullSchedule(plan.durationDays, safeStart, safeIncrement, startDate),
    [plan.durationDays, safeStart, safeIncrement, startDate]
  );

  const filteredSchedule = useMemo(() => {
    const q = daySearch.trim();
    if (!q) return fullSchedule;
    return fullSchedule.filter(
      (item) => String(item.dayNumber) === q || item.scheduledDate.includes(q)
    );
  }, [fullSchedule, daySearch]);

  const handleEnroll = async () => {
    await startChallenge({
      planCode: selectedPlan,
      startAmountInr: safeStart,
      incrementAmountInr: safeIncrement,
      startDate,
    });
    onEnrolled('dashboard');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          Challenge Enrollment · Full Schedule Preview Required Before Start
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
          Select & Configure Savings Challenge
        </h1>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {CHALLENGE_PLANS.map((tier) => {
          const isSelected = tier.code === selectedPlan;
          const planned = calculateTotalPlannedInr(tier.durationDays, safeStart, safeIncrement);
          const bonus = calculateIllustrativeBonusInr(planned, tier.illustrativeBonusRate);

          return (
            <button
              key={tier.code}
              type="button"
              onClick={() => setSelectedPlan(tier.code)}
              className={`text-left rounded-2xl p-5 border transition-colors flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-[#101B33] border-[#D4AF37]'
                  : 'bg-[#0B1324] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="text-xs text-slate-400">
                  {tier.durationDays} {tier.durationDays === 1 ? 'Day' : 'Days'} · {tier.targetAudience}
                </p>
                <h2 className="font-display text-lg font-bold text-slate-50 mt-1">
                  {tier.title}
                </h2>
                <p className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums mt-2">
                  {tier.illustrativeBonusRate === 0 ? '1 Streak' : `${tier.illustrativeBonusRate}%`}{' '}
                  <span className="text-xs font-sans font-normal text-slate-400">
                    {tier.illustrativeBonusRate === 0 ? '1-day only' : 'proposed 1x bonus'}
                  </span>
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/80 space-y-1 text-xs w-full">
                <div className="flex justify-between text-slate-300">
                  <span>Planned Total</span>
                  <span className="font-mono tabular-nums">{formatINR(planned)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Illustrative Bonus</span>
                  <span className="font-mono tabular-nums text-[#E5C158]">
                    {tier.illustrativeBonusRate === 0 ? '₹0 (1-Day)' : formatINR(bonus, true)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Configurator + Architectural Summary Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-slate-50">
            Configure Progressive Daily Deposit Rules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Day 1 Amount (₹)
              </label>
              <input
                type="number"
                min={10}
                max={10000}
                step={5}
                value={startAmountInr}
                onChange={(e) => setStartAmountInr(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
              <p className="text-[11px] text-slate-500 mt-1">Default: ₹10 (Min ₹10)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Daily Increment (₹)
              </label>
              <input
                type="number"
                min={5}
                max={5000}
                step={5}
                value={incrementAmountInr}
                onChange={(e) => setIncrementAmountInr(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
              <p className="text-[11px] text-slate-500 mt-1">Default: +₹10/day (Min ₹5)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#060B16] border border-slate-800 font-mono text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Final day: {fullSchedule[fullSchedule.length - 1]?.scheduledDate}
              </p>
            </div>
          </div>

          <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-400">
                {plan.durationDays === 1 ? 'Single-Day Deposit' : 'Day 1 / Day 2 / Day 3'}
              </p>
              <p className="font-mono font-semibold text-slate-100 tabular-nums mt-1">
                {plan.durationDays === 1
                  ? formatINR(safeStart)
                  : `${formatINR(safeStart)} / ${formatINR(safeStart + safeIncrement)} / ${formatINR(
                      safeStart + safeIncrement * 2
                    )}`}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Final Day ({plan.durationDays})</p>
              <p className="font-mono font-semibold text-slate-100 tabular-nums mt-1">
                {formatINR(fullSchedule[fullSchedule.length - 1]?.amountInr || 0)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Total Planned Savings</p>
              <p className="font-mono font-semibold text-[#E5C158] tabular-nums mt-1">
                {formatINR(totalPlannedInr)}
              </p>
            </div>
            <div>
              <p className="text-slate-400">
                {plan.illustrativeBonusRate === 0
                  ? 'Single-Day Streak'
                  : `Proposed ${plan.illustrativeBonusRate}% Bonus`}
              </p>
              <p className="font-mono font-semibold text-[#E5C158] tabular-nums mt-1">
                {plan.illustrativeBonusRate === 0
                  ? '1 / 1 Day (0%)'
                  : formatINR(illustrativeBonusInr, true)}
              </p>
            </div>
          </div>

          <div className="bg-[#060B16] border border-[#D4AF37]/30 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 text-[#E5C158] shrink-0 mt-0.5" />
            <p>
              {plan.illustrativeBonusRate === 0 ? (
                <>
                  <strong className="text-slate-100">1-Day Streak Rules:</strong> This challenge runs
                  for 1 day only (1 streak = complete) in simulated payment mode with no completion
                  bonus or guaranteed returns.
                </>
              ) : (
                <>
                  <strong className="text-slate-100">Illustrative Rate Disclosure:</strong> The{' '}
                  {plan.illustrativeBonusRate}% completion bonus (
                  {formatINR(illustrativeBonusInr, true)}) is calculated once on completion as{' '}
                  <span className="font-mono">
                    eligible_savings × {plan.illustrativeBonusRate} / 100
                  </span>
                  . These are proposed illustrative rates only—not guaranteed returns or regulated
                  deposit interest. Enrollment runs in simulated payment mode.
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={actionBusy}
            onClick={handleEnroll}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Enroll in {plan.title} ({formatINR(totalPlannedInr)} Simulated Schedule)
            </span>
          </button>
        </div>

        <div className="lg:col-span-5 bg-[#0B1324] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="h-44 sm:h-52 w-full bg-[#03060D] relative overflow-hidden">
            {!imgFailed ? (
              <img
                src={GOLD_LEDGER_IMG}
                alt="Stacked gold bars on dark slate symbolizing progressive daily savings"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0B1324] to-[#1A1405] flex items-center justify-center">
                <Calendar className="w-10 h-10 text-[#D4AF37]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1324] via-transparent to-transparent" />
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h3 className="font-display text-base font-bold text-slate-50">
                Pre-Enrollment Transparency Rules
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <li>1. Full day-by-day INR schedule is visible below before enrollment.</li>
                <li>2. Only 1 daily streak deposit is permitted every 24 hours; the next streak unlocks 24 hours after your last deposit.</li>
                <li>3. Missing a daily deposit deadline locks the challenge as FAILED.</li>
                <li>
                  4. Customer principal is never confiscated—remaining balance moves to the
                  Restricted Funds Ledger pending legal/partner review.
                </li>
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">
              Formula: Total = (N / 2) × (2 × Start + (N − 1) × Increment)
            </p>
          </div>
        </div>
      </div>

      {/* Full Schedule Preview Table */}
      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-50">
              Full {plan.durationDays}-Day Deposit Schedule Preview
            </h2>
            <p className="text-xs text-slate-400">
              Showing all {fullSchedule.length} scheduled simulated deposits before enrollment
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={daySearch}
              onChange={(e) => setDaySearch(e.target.value)}
              placeholder="Filter day # or YYYY-MM-DD"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#060B16] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto border border-slate-800/80 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#060B16] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Day</th>
                <th className="py-2.5 px-4 font-medium">Scheduled Date</th>
                <th className="py-2.5 px-4 font-medium text-right">Daily Deposit</th>
                <th className="py-2.5 px-4 font-medium text-right">Cumulative Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSchedule.map((row) => (
                <tr key={row.dayNumber} className="hover:bg-[#101B33]/60">
                  <td className="py-2.5 px-4 font-mono text-slate-200 tabular-nums">
                    Day {row.dayNumber}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums">
                    {row.scheduledDate}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-100 text-right tabular-nums">
                    {formatINR(row.amountInr)}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#E5C158] text-right tabular-nums">
                    {formatINR(row.cumulativeInr)}
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
