import React, { useMemo, useState } from 'react';
import { CreditCard, Download, Lock, Search, ShieldCheck } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';
import { formatINR } from '../lib/savingsEngine';
import { getUpiAppOption } from '../lib/upiGateway';
import type { WorkspaceTab } from './DashboardView';

export function LedgerSettlementView({
  onNavigate,
}: {
  onNavigate?: (tab: WorkspaceTab) => void;
}) {
  const { currentUid, state } = useSavings();
  const [txFilter, setTxFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const primaryAccount = useMemo(() => {
    const mine = state.paymentAccounts.filter((a) => a.userId === currentUid);
    return mine.find((a) => a.isPrimary) || mine[0] || null;
  }, [state.paymentAccounts, currentUid]);

  const transactions = useMemo(
    () =>
      state.transactions
        .filter((t) => t.userId === currentUid)
        .filter((t) => (txFilter === 'ALL' ? true : t.txType === txFilter))
        .filter((t) => {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            t.referenceId.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.transactions, currentUid, txFilter, searchQuery]
  );

  const restrictedEntries = useMemo(
    () =>
      state.restrictedFundsLedger
        .filter((r) => r.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.restrictedFundsLedger, currentUid]
  );

  const settlements = useMemo(
    () =>
      state.settlementRequests
        .filter((s) => s.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.settlementRequests, currentUid]
  );

  const rewards = useMemo(
    () =>
      state.rewardRecords
        .filter((r) => r.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.rewardRecords, currentUid]
  );

  const exportCsv = () => {
    const header = ['Date', 'Reference', 'Type', 'UPI Channel', 'Amount INR', 'Status', 'Description'];
    const rows = transactions.map((t) => [
      t.createdAt,
      t.referenceId,
      t.txType,
      t.upiApp
        ? `${getUpiAppOption(t.upiApp).shortCode}${t.upiVpaMasked ? ` (${t.upiVpaMasked})` : ''}`
        : 'SIMULATED',
      String(t.amountInr),
      t.reconciliationStatus,
      `"${t.description.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jr13-savings-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Transactions · Restricted Funds Ledger · Settlement History
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
            Ledger & Settlement History
          </h1>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="px-4 py-2.5 rounded-xl bg-[#0B1324] border border-slate-700 text-xs font-medium text-slate-200 hover:border-[#D4AF37] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[44px]"
        >
          <Download className="w-4 h-4 text-[#E5C158]" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Restricted Funds Ownership & Settlement History */}
      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E5C158]" />
            <h2 className="font-display text-lg font-bold text-slate-50">
              Restricted Funds Ledger & Settlements
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            100% User-Owned · Forfeiture & Admin Spending Prohibited
          </p>
        </div>

        <div className="bg-[#060B16] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <CreditCard className="w-4 h-4 text-[#E5C158] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-200">
                Designated Partner Settlement Destination
              </p>
              <p className="text-slate-400 font-mono mt-0.5">
                {primaryAccount
                  ? primaryAccount.accountType === 'UPI_VPA'
                    ? `${primaryAccount.accountLabel} · ${getUpiAppOption(primaryAccount.upiApp).name} (${primaryAccount.upiVpaMasked})`
                    : `${primaryAccount.accountLabel} · ${primaryAccount.bankName} ${primaryAccount.accountNumberMasked} · IFSC ${primaryAccount.ifscCode}`
                  : 'No payment account registered yet (register UPI VPA or Bank Account for settlement routing)'}
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#0B1324] border border-slate-700 text-xs font-medium text-[#E5C158] hover:border-[#D4AF37] whitespace-nowrap shrink-0"
            >
              {primaryAccount ? 'Manage Accounts' : 'Register Payment Account'}
            </button>
          )}
        </div>

        {restrictedEntries.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            No failed-challenge restricted funds entries. All active or completed challenge funds
            remain in standard tracking.
          </p>
        ) : (
          <div className="space-y-3">
            {restrictedEntries.map((entry) => {
              const req = settlements.find((s) => s.ledgerId === entry.id);
              return (
                <div
                  key={entry.id}
                  className="bg-[#060B16] border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 text-xs">
                    <p className="font-mono text-slate-400">
                      Ledger {entry.id} · Challenge {entry.challengeId}
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      Protected Principal:{' '}
                      <span className="font-mono text-[#E5C158] tabular-nums">
                        {formatINR(entry.principalBalanceInr)}
                      </span>
                    </p>
                    <p className="text-slate-300">
                      Ownership: <strong>{entry.ownershipStatus}</strong> · Review:{' '}
                      <strong>{entry.legalPartnerReviewStatus}</strong>
                    </p>
                    {entry.reconciliationNote && (
                      <p className="text-slate-400">Note: {entry.reconciliationNote}</p>
                    )}
                  </div>

                  <div className="lg:text-right space-y-1 text-xs">
                    <p className="font-medium text-slate-200 flex items-center lg:justify-end gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#E5C158]" />
                      <span>Settlement Status: {req?.status || 'PENDING_LEGAL_PARTNER_REVIEW'}</span>
                    </p>
                    {req?.status === 'SETTLED_REFUNDED' ? (
                      <div className="font-mono text-emerald-300 space-y-0.5">
                        <p>Legal Approval: {req.legalApprovalRef}</p>
                        <p>Partner Bank Ref: {req.partnerBankRef}</p>
                        <p>Tx Ref: {req.transactionRef} · {req.settledAt?.slice(0, 10)}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400">
                        Awaiting Indian legal/regulatory & regulated partner approval
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proposed Illustrative Reward Records */}
      {rewards.length > 0 && (
        <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-slate-50">
            Completion Bonus Records (Illustrative)
          </h2>
          <div className="divide-y divide-slate-800/80">
            {rewards.map((rw) => (
              <div
                key={rw.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {rw.bonusRatePct}% One-Time Completion Bonus on{' '}
                    <span className="font-mono">{formatINR(rw.eligibleSavingsInr)}</span>
                  </p>
                  <p className="text-slate-400 font-mono mt-0.5">
                    {rw.id} · {rw.status} · Proposed Illustrative Only
                  </p>
                </div>
                <p className="font-mono text-base font-bold text-[#E5C158] tabular-nums">
                  {formatINR(rw.bonusAmountInr, true)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Transaction History */}
      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-50">
            Simulated Transaction History
          </h2>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#060B16] border border-slate-800 rounded-lg overflow-x-auto">
              {[
                ['ALL', 'All'],
                ['SIMULATED_DEPOSIT', 'Deposits'],
                ['RESTRICTED_HOLD_TRANSFER', 'Restricted Holds'],
                ['ILLUSTRATIVE_BONUS_CREDIT', 'Bonuses'],
                ['APPROVED_REFUND_SETTLEMENT', 'Settlements'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTxFilter(key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    txFilter === key
                      ? 'bg-[#D4AF37] text-[#060B16]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ref or description"
                className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-lg bg-[#060B16] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-6">No matching simulated transactions found.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#060B16] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Reference ID</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Description</th>
                  <th className="py-2.5 px-4 font-medium">Reconciliation</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#101B33]/50">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap tabular-nums">
                      {tx.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                      {tx.referenceId}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{tx.txType}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {tx.description}
                      {tx.upiApp
                        ? ` · ${getUpiAppOption(tx.upiApp).shortCode}${tx.upiVpaMasked ? ` (${tx.upiVpaMasked})` : ''}`
                        : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {tx.reconciliationStatus}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#E5C158] text-right whitespace-nowrap tabular-nums">
                      {formatINR(tx.amountInr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
