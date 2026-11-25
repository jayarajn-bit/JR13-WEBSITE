import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import {
  formatINR,
  getChallengeDescription,
  getChallengeFailureCause,
} from '../lib/savingsEngine';
import { getUpiAppOption, UPI_APPS, UPI_REGULATORY_GATE_NOTICE } from '../lib/upiGateway';

type AdminSubTab =
  | 'overview'
  | 'missed'
  | 'users'
  | 'restricted'
  | 'reconciliation'
  | 'upi'
  | 'audit';

export function AdminConsoleView() {
  const {
    isAdmin,
    adminRole,
    state,
    actionBusy,
    reconcileTransaction,
    addLedgerReconciliationNote,
    approveAndRecordPartnerSettlement,
    toggleUserStatus,
  } = useSavings();

  const [subTab, setSubTab] = useState<AdminSubTab>('overview');
  const [showProfitOption, setShowProfitOption] = useState<boolean>(false);
  const [partnerSpreadPct, setPartnerSpreadPct] = useState<number>(1.5);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [settlementForms, setSettlementForms] = useState<
    Record<string, { legalApprovalRef: string; partnerBankRef: string; transactionRef: string }>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const activeChallenges = state.challenges.filter((c) => c.status === 'ACTIVE');
    const failedChallenges = state.challenges.filter((c) => c.status === 'FAILED');
    const completedChallenges = state.challenges.filter((c) => c.status === 'COMPLETED');

    const activeCount = activeChallenges.length;
    const failedCount = failedChallenges.length;
    const completedCount = completedChallenges.length;

    const brokenStreaksCount = state.streaks.filter((s) => s.streakBroken).length;
    const missedContributionRecords = state.dailyContributions.filter(
      (d) => d.status === 'MISSED'
    ).length;

    const missedChallengeSavedInr = failedChallenges.reduce((sum, c) => sum + c.totalSavedInr, 0);
    const missedChallengePlannedInr = failedChallenges.reduce(
      (sum, c) => sum + c.totalPlannedInr,
      0
    );
    const missedUncollectedGapInr = failedChallenges.reduce(
      (sum, c) => sum + Math.max(0, c.totalPlannedInr - c.totalSavedInr),
      0
    );

    const totalRestrictedPending = state.restrictedFundsLedger
      .filter((r) => r.ownershipStatus === 'USER_OWNED_RESTRICTED')
      .reduce((sum, r) => sum + r.principalBalanceInr, 0);
    const totalSettled = state.settlementRequests
      .filter((s) => s.status === 'SETTLED_REFUNDED')
      .reduce((sum, s) => sum + s.amountInr, 0);
    const totalRewards = state.rewardRecords.reduce((sum, r) => sum + r.bonusAmountInr, 0);
    const totalVolumeAllChallenges = state.challenges.reduce(
      (sum, c) => sum + c.totalSavedInr,
      0
    );
    const safeSpread = Math.max(0, Math.min(25, Number(partnerSpreadPct) || 0));
    const illustrativePartnerSpreadInr =
      Math.round(((totalVolumeAllChallenges * safeSpread) / 100) * 100) / 100;
    const netIllustrativeProfitInr =
      Math.round((illustrativePartnerSpreadInr - totalRewards) * 100) / 100;

    return {
      failedChallenges,
      activeCount,
      failedCount,
      completedCount,
      brokenStreaksCount,
      missedContributionRecords,
      missedChallengeSavedInr,
      missedChallengePlannedInr,
      missedUncollectedGapInr,
      totalRestrictedPending,
      totalSettled,
      totalRewards,
      totalVolumeAllChallenges,
      illustrativePartnerSpreadInr,
      netIllustrativeProfitInr,
    };
  }, [state, partnerSpreadPct]);

  if (!isAdmin) {
    return (
      <div className="bg-[#0B1324] border border-red-500/30 rounded-2xl p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-red-400 mx-auto" />
        <h1 className="font-display text-xl font-bold text-slate-50">
          Role-Based Access Required
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The Admin & Compliance Console is restricted to authorized Compliance Admins,
          Reconciliation Officers, and Super Admins.
        </p>
      </div>
    );
  }

  const exportComplianceReport = () => {
    const lines = [
      'Section,ID,User,Amount INR,Status,Description,Cause / Detail',
      ...metrics.failedChallenges.map(
        (c) =>
          `MissedDeadlineChallenge,${c.id},${c.userId},${c.totalSavedInr},${c.status},"${getChallengeDescription(c).replace(/"/g, '""')}","${getChallengeFailureCause(c.failedReason).replace(/"/g, '""')}"`
      ),
      ...state.restrictedFundsLedger.map(
        (r) =>
          `RestrictedLedger,${r.id},${r.userId},${r.principalBalanceInr},${r.legalPartnerReviewStatus},"User-owned restricted principal hold","${(r.reconciliationNote || '').replace(/"/g, '""')}"`
      ),
      ...state.settlementRequests.map(
        (s) =>
          `Settlement,${s.id},${s.userId},${s.amountInr},${s.status},"Partner refund settlement request","${s.legalApprovalRef || 'PENDING'} | ${s.transactionRef || ''}"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jr13-compliance-reconciliation-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSettle = async (settlementId: string) => {
    setFormError(null);
    const form = settlementForms[settlementId] || {
      legalApprovalRef: '',
      partnerBankRef: '',
      transactionRef: '',
    };
    try {
      await approveAndRecordPartnerSettlement(settlementId, form);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to record settlement.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Compliance & Reconciliation Console · Role: {adminRole} · Admin Spend Prohibited
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
            Admin Governance Dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={exportComplianceReport}
          className="px-4 py-2.5 rounded-xl bg-[#0B1324] border border-slate-700 text-xs font-medium text-slate-200 hover:border-[#D4AF37] inline-flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[44px]"
        >
          <Download className="w-4 h-4 text-[#E5C158]" />
          <span>Export Compliance Report</span>
        </button>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[#0B1324] border border-slate-800 rounded-xl overflow-x-auto">
        {[
          ['overview', 'Overview & Reports'],
          ['missed', 'Missed Streaks & Profit'],
          ['users', 'Users & Challenges'],
          ['restricted', 'Restricted Ledger & Settlements'],
          ['reconciliation', 'Transactions & Rewards'],
          ['upi', 'UPI & Partner Gateway'],
          ['audit', 'Audit Logs'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id as AdminSubTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              subTab === id
                ? 'bg-[#D4AF37] text-[#060B16]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Challenges Breakdown</p>
              <p className="font-mono text-xl font-bold text-slate-50 tabular-nums mt-1">
                {metrics.activeCount} Active · {metrics.failedCount} Failed · {metrics.completedCount}{' '}
                Done
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Missed Streak &amp; Deadline Money</p>
              <p className="font-mono text-2xl font-bold text-red-300 tabular-nums mt-1">
                {formatINR(metrics.missedChallengeSavedInr)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.failedCount} failed challenge{metrics.failedCount === 1 ? '' : 's'} ·{' '}
                {metrics.brokenStreaksCount} broken streak{metrics.brokenStreaksCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Restricted Funds Held (User-Owned)</p>
              <p className="font-mono text-2xl font-bold text-amber-300 tabular-nums mt-1">
                {formatINR(metrics.totalRestrictedPending)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Pending legal &amp; regulated partner review
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Completed Partner Settlements</p>
              <p className="font-mono text-2xl font-bold text-emerald-300 tabular-nums mt-1">
                {formatINR(metrics.totalSettled)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Illustrative bonuses logged: {formatINR(metrics.totalRewards, true)}
              </p>
            </div>
          </div>

          {/* Admin-Only Profit Option Toggle Card */}
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-50">
                  Admin Profit &amp; Margin View Option
                </h2>
                <p className="text-xs text-slate-400">
                  Visible strictly inside the Admin Console. Missed customer principal is never counted as profit.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProfitOption((prev) => !prev)}
                  className="px-3.5 py-2 rounded-xl bg-[#060B16] border border-[#D4AF37]/40 text-xs font-semibold text-[#E5C158] hover:border-[#D4AF37] inline-flex items-center gap-2 min-h-[40px]"
                >
                  {showProfitOption ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showProfitOption ? 'Hide Profit Option' : 'Show Profit Option'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('missed')}
                  className="px-3.5 py-2 rounded-xl bg-[#D4AF37] text-[#060B16] text-xs font-semibold hover:bg-[#E5C158] min-h-[40px]"
                >
                  Missed &amp; Profit Ledger
                </button>
              </div>
            </div>

            {showProfitOption && (
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Forfeited Profit from Missed Streaks</p>
                  <p className="font-mono text-xl font-bold text-slate-100 tabular-nums mt-1">
                    {formatINR(0)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {formatINR(metrics.missedChallengeSavedInr)} remains user-owned (prohibited)
                  </p>
                </div>
                <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">
                    Illustrative Partner Float ({partnerSpreadPct}%)
                  </p>
                  <p className="font-mono text-xl font-bold text-[#E5C158] tabular-nums mt-1">
                    {formatINR(metrics.illustrativePartnerSpreadInr, true)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    On {formatINR(metrics.totalVolumeAllChallenges)} total simulated volume
                  </p>
                </div>
                <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Illustrative Bonus Outflow</p>
                  <p className="font-mono text-xl font-bold text-amber-300 tabular-nums mt-1">
                    {formatINR(metrics.totalRewards, true)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Logged across {state.rewardRecords.length} completed challenge(s)
                  </p>
                </div>
                <div className="bg-[#060B16] border border-[#D4AF37]/40 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Net Illustrative Profit (Simulated)</p>
                  <p
                    className={`font-mono text-xl font-bold tabular-nums mt-1 ${
                      metrics.netIllustrativeProfitInr >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {formatINR(metrics.netIllustrativeProfitInr, true)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Partner spread minus illustrative bonuses
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#0B1324] border border-[#D4AF37]/30 rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-100 mb-1">
                Restricted-Funds Governance &amp; Non-Discrimination Policy
              </p>
              <p>
                Challenge rules, 24-hour streak limits, and zero-forfeiture protections apply uniformly
                without discrimination. Administrators may view, audit, and add reconciliation notes
                only. Spending, withdrawal, reallocation, or forfeiture of customer restricted balances
                is strictly prohibited, and settlements require legal and regulated partner references.
              </p>
            </div>
          </div>
        </div>
      )}

      {subTab === 'missed' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Missed-Deadline Challenges</p>
              <p className="font-mono text-2xl font-bold text-red-300 tabular-nums mt-1">
                {metrics.failedCount}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Broken streaks: <span className="font-mono">{metrics.brokenStreaksCount}</span> ·
                Missed day logs: <span className="font-mono">{metrics.missedContributionRecords}</span>
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Total Missed-Challenge Principal</p>
              <p className="font-mono text-2xl font-bold text-[#E5C158] tabular-nums mt-1">
                {formatINR(metrics.missedChallengeSavedInr)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                100% preserved under customer ownership
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Uncollected Planned Targets</p>
              <p className="font-mono text-2xl font-bold text-slate-100 tabular-nums mt-1">
                {formatINR(metrics.missedUncollectedGapInr)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Out of {formatINR(metrics.missedChallengePlannedInr)} planned
              </p>
            </div>
            <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Forfeited / Confiscated Profit</p>
              <p className="font-mono text-2xl font-bold text-emerald-300 tabular-nums mt-1">
                {formatINR(0)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Zero forfeiture enforced by ledger policy
              </p>
            </div>
          </div>

          {/* Admin-Only Profit Option & Model Simulator */}
          <div className="bg-[#0B1324] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <TrendingUp className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-50">
                    Profit Option (Admin Section Only — Simulated Illustrative Model)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calculates illustrative partner nodal float vs completion bonus liability. Missed
                    customer deposits are excluded from profit and kept strictly in Restricted Funds.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="text-xs text-slate-300 whitespace-nowrap">
                  Partner Spread (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  step={0.25}
                  value={partnerSpreadPct}
                  onChange={(e) => setPartnerSpreadPct(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg bg-[#060B16] border border-slate-800 font-mono text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                <p className="text-slate-400">Total Simulated Volume</p>
                <p className="font-mono text-lg font-bold text-slate-100 tabular-nums mt-1">
                  {formatINR(metrics.totalVolumeAllChallenges)}
                </p>
              </div>
              <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                <p className="text-slate-400">Illustrative Spread ({partnerSpreadPct}%)</p>
                <p className="font-mono text-lg font-bold text-[#E5C158] tabular-nums mt-1">
                  {formatINR(metrics.illustrativePartnerSpreadInr, true)}
                </p>
              </div>
              <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4">
                <p className="text-slate-400">Completion Bonuses Logged</p>
                <p className="font-mono text-lg font-bold text-amber-300 tabular-nums mt-1">
                  {formatINR(metrics.totalRewards, true)}
                </p>
              </div>
              <div className="bg-[#060B16] border border-[#D4AF37]/40 rounded-xl p-4">
                <p className="text-slate-400">Projected Illustrative Net Profit</p>
                <p
                  className={`font-mono text-lg font-bold tabular-nums mt-1 ${
                    metrics.netIllustrativeProfitInr >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {formatINR(metrics.netIllustrativeProfitInr, true)}
                </p>
              </div>
            </div>
          </div>

          {/* Failed & Missed-Streak Challenges Breakdown Table */}
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h2 className="font-display text-lg font-bold text-slate-50">
                  Missed Streak &amp; Failed Deadline Challenge Ledger
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {metrics.failedChallenges.length} record
                {metrics.failedChallenges.length === 1 ? '' : 's'}
              </span>
            </div>

            {metrics.failedChallenges.length === 0 ? (
              <p className="text-xs text-slate-400">
                No missed-deadline or failed challenges recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Challenge ID</th>
                      <th className="py-2.5 px-4 font-medium">Description</th>
                      <th className="py-2.5 px-4 font-medium">Failure Cause</th>
                      <th className="py-2.5 px-4 font-medium text-right">Missed Gap (₹)</th>
                      <th className="py-2.5 px-4 font-medium text-right">User Principal (₹)</th>
                      <th className="py-2.5 px-4 font-medium">Restricted Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {metrics.failedChallenges.map((c) => {
                      const ledger = state.restrictedFundsLedger.find(
                        (r) => r.challengeId === c.id
                      );
                      const gap = Math.max(0, c.totalPlannedInr - c.totalSavedInr);
                      return (
                        <tr key={c.id}>
                          <td className="py-3 px-4 font-mono text-slate-200 align-top">
                            <p>{c.id}</p>
                            <p className="text-[11px] text-slate-400">{c.userId}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-300 align-top max-w-xs">
                            <p>{getChallengeDescription(c)}</p>
                            {ledger?.reconciliationNote && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Ledger Note: {ledger.reconciliationNote}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-red-200 align-top max-w-xs">
                            {getChallengeFailureCause(c.failedReason)}
                          </td>
                          <td className="py-3 px-4 font-mono text-right text-slate-400 tabular-nums align-top">
                            {formatINR(gap)}
                          </td>
                          <td className="py-3 px-4 font-mono text-right text-[#E5C158] tabular-nums align-top">
                            {formatINR(c.totalSavedInr)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300 align-top">
                            {ledger ? ledger.ownershipStatus : 'ZERO_BALANCE_LOCKED'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-50">User Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">User</th>
                    <th className="py-2.5 px-4 font-medium">Email</th>
                    <th className="py-2.5 px-4 font-medium">Provider</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {state.users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 px-4 font-medium text-slate-100">{u.displayName}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3 px-4 text-slate-400">{u.authProvider}</td>
                      <td className="py-3 px-4 font-mono text-slate-200">{u.accountStatus}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            toggleUserStatus(
                              u.uid,
                              u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#060B16] border border-slate-700 text-xs text-slate-200 hover:border-[#D4AF37]"
                        >
                          {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Active & Failed Challenges
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Challenge ID</th>
                    <th className="py-2.5 px-4 font-medium">User</th>
                    <th className="py-2.5 px-4 font-medium">Description &amp; Cause</th>
                    <th className="py-2.5 px-4 font-medium">Progress</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Saved (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {state.challenges.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-mono text-slate-300 align-top">{c.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-400 align-top">{c.userId}</td>
                      <td className="py-3 px-4 text-slate-200 align-top max-w-xs">
                        <p>{getChallengeDescription(c)}</p>
                        {c.status === 'FAILED' && (
                          <p className="text-[11px] text-red-300 mt-0.5">
                            Cause: {getChallengeFailureCause(c.failedReason)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-300 align-top">
                        {c.completedDays}/{c.durationDays}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200 align-top">
                        {c.status} {c.locked ? '(LOCKED)' : ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-[#E5C158] tabular-nums align-top">
                        {formatINR(c.totalSavedInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'restricted' && (
        <div className="space-y-6">
          {formError && (
            <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-3 text-xs text-red-200">
              {formError}
            </div>
          )}

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Restricted Funds Ledger (View & Reconcile Only)
            </h2>
            <div className="space-y-4">
              {state.restrictedFundsLedger.map((entry) => {
                const req = state.settlementRequests.find((s) => s.ledgerId === entry.id);
                const form = settlementForms[req?.id || ''] || {
                  legalApprovalRef: '',
                  partnerBankRef: '',
                  transactionRef: '',
                };

                return (
                  <div
                    key={entry.id}
                    className="bg-[#060B16] border border-slate-800 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1 text-xs">
                        <p className="font-mono text-slate-400">
                          {entry.id} · User {entry.userId} · Challenge {entry.challengeId}
                        </p>
                        <p className="text-base font-semibold text-slate-100">
                          User-Owned Restricted Principal:{' '}
                          <span className="font-mono text-[#E5C158] tabular-nums">
                            {formatINR(entry.principalBalanceInr)}
                          </span>
                        </p>
                        <p className="text-slate-300">
                          Forfeiture Prohibited: <strong>YES</strong> · Admin Spend Prohibited:{' '}
                          <strong>YES</strong> · Review: <strong>{entry.legalPartnerReviewStatus}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled
                          title="Blocked by compliance policy"
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-500 cursor-not-allowed inline-flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Spend / Forfeit Disabled</span>
                        </button>
                      </div>
                    </div>

                    {/* Reconciliation Note */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={noteInputs[entry.id] ?? entry.reconciliationNote ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        placeholder="Add reconciliation audit note..."
                        className="flex-1 px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          addLedgerReconciliationNote(
                            entry.id,
                            noteInputs[entry.id] ?? entry.reconciliationNote ?? ''
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-[#0B1324] border border-slate-700 text-xs font-medium text-slate-200 hover:border-[#D4AF37] whitespace-nowrap"
                      >
                        Save Reconciliation Note
                      </button>
                    </div>

                    {/* Authorized Partner Settlement Recording */}
                    {req && req.status !== 'SETTLED_REFUNDED' && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-3">
                        <p className="text-xs font-semibold text-[#E5C158]">
                          Record Authorized Legal & Regulated-Partner Refund Settlement
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={form.legalApprovalRef}
                            onChange={(e) =>
                              setSettlementForms((prev) => ({
                                ...prev,
                                [req.id]: { ...form, legalApprovalRef: e.target.value },
                              }))
                            }
                            placeholder="Legal Approval Ref (e.g. LEG-2026-104)"
                            className="px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 font-mono text-xs text-slate-100"
                          />
                          <input
                            type="text"
                            value={form.partnerBankRef}
                            onChange={(e) =>
                              setSettlementForms((prev) => ({
                                ...prev,
                                [req.id]: { ...form, partnerBankRef: e.target.value },
                              }))
                            }
                            placeholder="Regulated Partner Ref (e.g. HDFC-ESC-91)"
                            className="px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 font-mono text-xs text-slate-100"
                          />
                          <input
                            type="text"
                            value={form.transactionRef}
                            onChange={(e) =>
                              setSettlementForms((prev) => ({
                                ...prev,
                                [req.id]: { ...form, transactionRef: e.target.value },
                              }))
                            }
                            placeholder="Settlement Tx / UTR Ref"
                            className="px-3 py-2 rounded-lg bg-[#0B1324] border border-slate-800 font-mono text-xs text-slate-100"
                          />
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleSettle(req.id)}
                            className="px-4 py-2 rounded-lg bg-[#D4AF37] text-[#060B16] text-xs font-semibold hover:bg-[#E5C158] transition-colors whitespace-nowrap"
                          >
                            Record Partner Settlement
                          </button>
                        </div>
                      </div>
                    )}

                    {req && req.status === 'SETTLED_REFUNDED' && (
                      <div className="pt-3 border-t border-slate-800/80 text-xs font-mono text-emerald-300 flex flex-wrap gap-4">
                        <span>Status: SETTLED_REFUNDED</span>
                        <span>Legal: {req.legalApprovalRef}</span>
                        <span>Partner: {req.partnerBankRef}</span>
                        <span>Tx Ref: {req.transactionRef}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Transaction Reconciliation
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Reference</th>
                    <th className="py-2.5 px-4 font-medium">User</th>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {state.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 px-4 font-mono text-slate-200">{tx.referenceId}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{tx.userId}</td>
                      <td className="py-3 px-4 text-slate-300">{tx.txType}</td>
                      <td className="py-3 px-4 font-mono text-right text-[#E5C158] tabular-nums">
                        {formatINR(tx.amountInr)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {tx.reconciliationStatus}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {tx.reconciliationStatus === 'RECONCILED' ? (
                          <span className="text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reconcileTransaction(tx.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#060B16] font-semibold"
                          >
                            Reconcile
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Reward Calculations (Illustrative Completion Bonuses)
            </h2>
            {state.rewardRecords.length === 0 ? (
              <p className="text-xs text-slate-400">No completed challenge rewards logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Reward ID</th>
                      <th className="py-2.5 px-4 font-medium">User</th>
                      <th className="py-2.5 px-4 font-medium text-right">Eligible Savings</th>
                      <th className="py-2.5 px-4 font-medium text-right">Rate</th>
                      <th className="py-2.5 px-4 font-medium text-right">Calculated Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {state.rewardRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-4 font-mono text-slate-200">{r.id}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{r.userId}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums">
                          {formatINR(r.eligibleSavingsInr)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums">
                          {r.bonusRatePct}%
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-[#E5C158] tabular-nums">
                          {formatINR(r.bonusAmountInr, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'upi' && (
        <div className="space-y-6">
          <div className="bg-[#0B1324] border border-[#D4AF37]/30 rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
            <Lock className="w-5 h-5 text-[#E5C158] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-100">
                UPI Partner Integration Gate — Live Debit Locked (SIMULATED_SANDBOX)
              </p>
              <p>{UPI_REGULATORY_GATE_NOTICE}</p>
            </div>
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-50">
                Supported NPCI UPI Apps & Intent Channels
              </h2>
              <p className="text-xs font-mono text-[#E5C158]">
                Merchant VPA: jr13.sandbox@simulated.npci
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">UPI App</th>
                    <th className="py-2.5 px-4 font-medium">Intent URI Scheme</th>
                    <th className="py-2.5 px-4 font-medium">Sample Handle</th>
                    <th className="py-2.5 px-4 font-medium text-right">Simulated Tx Count</th>
                    <th className="py-2.5 px-4 font-medium text-right">Simulated Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {UPI_APPS.map((app) => {
                    const appTxs = state.transactions.filter((t) => t.upiApp === app.id);
                    const appVol = appTxs.reduce((sum, t) => sum + t.amountInr, 0);
                    return (
                      <tr key={app.id}>
                        <td className="py-3 px-4 font-medium text-slate-100 inline-flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-[#E5C158]" />
                          <span>{app.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{app.schemePrefix}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{app.sampleHandle}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-200">
                          {appTxs.length}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-[#E5C158]">
                          {formatINR(appVol)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-300">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Regulated Partner & Legal Onboarding Checklist (Before Enabling Live UPI)
            </h2>
            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li>
                RBI-authorized Payment Aggregator (PA) or Sponsor Bank nodal/escrow account agreement executed.
              </li>
              <li>
                Legal counsel sign-off confirming savings product structure does not constitute unauthorized deposit-taking or guaranteed interest.
              </li>
              <li>
                Production NPCI Merchant VPA (`UPI_MERCHANT_VPA`), webhook HMAC signature verification, and UPI Intent callback reconciliation verified.
              </li>
              <li>
                Automated refund/settlement flow for `FAILED` challenges approved in partner escrow rules (current simulated UPI transactions:{' '}
                <span className="font-mono text-slate-100">
                  {state.transactions.filter((t) => Boolean(t.upiApp)).length}
                </span>
                {state.transactions.some((t) => Boolean(t.upiApp))
                  ? ` · latest via ${getUpiAppOption(state.transactions.find((t) => Boolean(t.upiApp))?.upiApp).name}`
                  : ''}
                ).
              </li>
            </ul>
          </div>
        </div>
      )}

      {subTab === 'audit' && (
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-50">
            Immutable Compliance Audit Logs
          </h2>
          <div className="divide-y divide-slate-800/70">
            {state.auditLogs
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((log) => (
                <div key={log.id} className="py-3.5 text-xs space-y-1">
                  <p className="font-mono text-slate-400">
                    {log.createdAt} · {log.actorRole} ({log.actorUid}) · {log.entityType}/{log.entityId}
                  </p>
                  <p className="font-semibold text-[#E5C158]">{log.action}</p>
                  <p className="text-slate-200">{log.summary}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
