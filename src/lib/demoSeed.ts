import { addDaysIso, calculateIllustrativeBonusInr, calculateTotalPlannedInr, getDayAmountInr } from './savingsEngine';
import type {
  AppStateSnapshot,
  DailyContribution,
  TransactionRecord,
} from '../types/savings';

export const DEMO_SAVER_UID = 'demo_saver_arjun';
export const DEMO_SAVER_2_UID = 'demo_saver_priya';
export const DEMO_ADMIN_UID = 'demo_admin_compliance';

export function buildInitialDemoState(): AppStateSnapshot {
  const today = '2026-11-24';
  const arjunActiveStart = addDaysIso(today, -12);
  const arjunFailedStart = '2026-09-01';
  const arjunCompletedStart = '2026-07-01';
  const priyaActiveStart = addDaysIso(today, -6);

  const arjunActivePlanned = calculateTotalPlannedInr(99, 10, 10);
  const arjunFailedPlanned = calculateTotalPlannedInr(49, 10, 10);
  const arjunCompletedPlanned = calculateTotalPlannedInr(49, 10, 10);
  const priyaActivePlanned = calculateTotalPlannedInr(364, 20, 10);

  const arjunContributions: DailyContribution[] = [];
  const arjunTransactions: TransactionRecord[] = [];
  let arjunActiveSaved = 0;

  // 12 completed days on Arjun's active 99-day challenge (Day 13 is due today!)
  for (let d = 1; d <= 12; d += 1) {
    const amt = getDayAmountInr(d, 10, 10);
    arjunActiveSaved += amt;
    const dateStr = addDaysIso(arjunActiveStart, d - 1);
    arjunContributions.push({
      id: `contrib_arjun_99_${d}`,
      userId: DEMO_SAVER_UID,
      challengeId: 'chl_arjun_99d_active',
      dayNumber: d,
      scheduledDate: dateStr,
      amountInr: amt,
      status: 'PAID_SIMULATED',
      referenceCode: `SIM-DEP-99${String(d).padStart(3, '0')}`,
      createdAt: `${dateStr}T09:15:00.000Z`,
    });
    arjunTransactions.push({
      id: `tx_arjun_99_${d}`,
      userId: DEMO_SAVER_UID,
      challengeId: 'chl_arjun_99d_active',
      txType: 'SIMULATED_DEPOSIT',
      amountInr: amt,
      simulated: true,
      referenceId: `SIM-DEP-99${String(d).padStart(3, '0')}`,
      reconciliationStatus: 'RECONCILED',
      description: `Day ${d} simulated deposit for 99-Day Foundation`,
      createdAt: `${dateStr}T09:15:00.000Z`,
    });
  }

  // Failed challenge contributions (15 days = ₹1,200 saved before missed deadline on Day 16)
  let arjunFailedSaved = 0;
  for (let d = 1; d <= 15; d += 1) {
    const amt = getDayAmountInr(d, 10, 10);
    arjunFailedSaved += amt;
    const dateStr = addDaysIso(arjunFailedStart, d - 1);
    arjunContributions.push({
      id: `contrib_arjun_49f_${d}`,
      userId: DEMO_SAVER_UID,
      challengeId: 'chl_arjun_49d_failed',
      dayNumber: d,
      scheduledDate: dateStr,
      amountInr: amt,
      status: 'PAID_SIMULATED',
      referenceCode: `SIM-DEP-49F${String(d).padStart(2, '0')}`,
      createdAt: `${dateStr}T10:00:00.000Z`,
    });
  }

  arjunTransactions.push({
    id: 'tx_arjun_49f_hold',
    userId: DEMO_SAVER_UID,
    challengeId: 'chl_arjun_49d_failed',
    txType: 'RESTRICTED_HOLD_TRANSFER',
    amountInr: arjunFailedSaved,
    simulated: true,
    referenceId: 'RST-HOLD-4901',
    reconciliationStatus: 'RECONCILED',
    description:
      'Preserved user-owned balance moved to Restricted Funds Ledger after missed Day 16 deadline',
    createdAt: '2026-09-17T00:05:00.000Z',
  });

  // Priya's active 364-day challenge (6 days completed)
  let priyaSaved = 0;
  for (let d = 1; d <= 6; d += 1) {
    const amt = getDayAmountInr(d, 20, 10);
    priyaSaved += amt;
    const dateStr = addDaysIso(priyaActiveStart, d - 1);
    arjunContributions.push({
      id: `contrib_priya_364_${d}`,
      userId: DEMO_SAVER_2_UID,
      challengeId: 'chl_priya_364d_active',
      dayNumber: d,
      scheduledDate: dateStr,
      amountInr: amt,
      status: 'PAID_SIMULATED',
      referenceCode: `SIM-DEP-364${String(d).padStart(2, '0')}`,
      createdAt: `${dateStr}T08:30:00.000Z`,
    });
    arjunTransactions.push({
      id: `tx_priya_364_${d}`,
      userId: DEMO_SAVER_2_UID,
      challengeId: 'chl_priya_364d_active',
      txType: 'SIMULATED_DEPOSIT',
      amountInr: amt,
      simulated: true,
      referenceId: `SIM-DEP-364${String(d).padStart(2, '0')}`,
      reconciliationStatus: 'RECONCILED',
      description: `Day ${d} simulated deposit for 364-Day Sovereign`,
      createdAt: `${dateStr}T08:30:00.000Z`,
    });
  }

  // Completed 49-day challenge reward for Arjun
  const completedBonus = calculateIllustrativeBonusInr(arjunCompletedPlanned, 2);
  arjunTransactions.push({
    id: 'tx_arjun_49c_bonus',
    userId: DEMO_SAVER_UID,
    challengeId: 'chl_arjun_49d_completed',
    txType: 'ILLUSTRATIVE_BONUS_CREDIT',
    amountInr: completedBonus,
    simulated: true,
    referenceId: 'BON-ILL-4902',
    reconciliationStatus: 'RECONCILED',
    description: '2% proposed illustrative one-time completion bonus (simulated)',
    createdAt: '2026-08-19T11:30:00.000Z',
  });

  // Settled refund example for Priya
  arjunTransactions.push({
    id: 'tx_priya_settled_refund',
    userId: DEMO_SAVER_2_UID,
    challengeId: 'chl_priya_49d_failed',
    txType: 'APPROVED_REFUND_SETTLEMENT',
    amountInr: 660,
    simulated: true,
    referenceId: 'UTR-SIM-984210',
    reconciliationStatus: 'RECONCILED',
    description: 'Partner-approved settlement refund recorded for failed 49-Day Sprint',
    createdAt: '2026-10-15T14:20:00.000Z',
  });

  return {
    users: [
      {
        uid: DEMO_SAVER_UID,
        email: 'arjun.mehta@demo.jr13.in',
        displayName: 'Arjun Mehta',
        authProvider: 'demo',
        accountStatus: 'ACTIVE',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-11-24T09:15:00.000Z',
      },
      {
        uid: DEMO_SAVER_2_UID,
        email: 'priya.nair@demo.jr13.in',
        displayName: 'Priya Nair',
        authProvider: 'demo',
        accountStatus: 'ACTIVE',
        createdAt: '2026-09-10T08:00:00.000Z',
        updatedAt: '2026-11-24T08:30:00.000Z',
      },
    ],
    profiles: [
      {
        userId: DEMO_SAVER_UID,
        fullName: 'Arjun Mehta',
        phoneMasked: '+91 98••••4310',
        city: 'Bengaluru',
        state: 'Karnataka',
        preferredStartInr: 10,
        preferredIncrementInr: 10,
        kycSimulationStatus: 'SIMULATED_VERIFIED',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
      {
        userId: DEMO_SAVER_2_UID,
        fullName: 'Priya Nair',
        phoneMasked: '+91 97••••8821',
        city: 'Kochi',
        state: 'Kerala',
        preferredStartInr: 20,
        preferredIncrementInr: 10,
        kycSimulationStatus: 'SIMULATED_VERIFIED',
        updatedAt: '2026-11-18T12:00:00.000Z',
      },
    ],
    challenges: [
      {
        id: 'chl_arjun_99d_active',
        userId: DEMO_SAVER_UID,
        planCode: '99D_4PCT',
        durationDays: 99,
        illustrativeBonusRate: 4,
        startAmountInr: 10,
        incrementAmountInr: 10,
        totalPlannedInr: arjunActivePlanned,
        totalSavedInr: arjunActiveSaved,
        completedDays: 12,
        status: 'ACTIVE',
        locked: false,
        simulatedMode: true,
        startDate: arjunActiveStart,
        nextDueDate: today,
        createdAt: `${arjunActiveStart}T09:00:00.000Z`,
        updatedAt: `${today}T09:15:00.000Z`,
      },
      {
        id: 'chl_arjun_49d_failed',
        userId: DEMO_SAVER_UID,
        planCode: '49D_2PCT',
        durationDays: 49,
        illustrativeBonusRate: 2,
        startAmountInr: 10,
        incrementAmountInr: 10,
        totalPlannedInr: arjunFailedPlanned,
        totalSavedInr: arjunFailedSaved,
        completedDays: 15,
        status: 'FAILED',
        locked: true,
        simulatedMode: true,
        startDate: arjunFailedStart,
        nextDueDate: addDaysIso(arjunFailedStart, 15),
        failedReason:
          'Missed Day 16 deposit deadline. Challenge locked; principal preserved in Restricted Funds Ledger.',
        createdAt: `${arjunFailedStart}T09:00:00.000Z`,
        updatedAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'chl_arjun_49d_completed',
        userId: DEMO_SAVER_UID,
        planCode: '49D_2PCT',
        durationDays: 49,
        illustrativeBonusRate: 2,
        startAmountInr: 10,
        incrementAmountInr: 10,
        totalPlannedInr: arjunCompletedPlanned,
        totalSavedInr: arjunCompletedPlanned,
        completedDays: 49,
        status: 'COMPLETED',
        locked: true,
        simulatedMode: true,
        startDate: arjunCompletedStart,
        nextDueDate: '2026-08-18',
        createdAt: `${arjunCompletedStart}T09:00:00.000Z`,
        updatedAt: '2026-08-19T11:30:00.000Z',
      },
      {
        id: 'chl_priya_364d_active',
        userId: DEMO_SAVER_2_UID,
        planCode: '364D_8PCT',
        durationDays: 364,
        illustrativeBonusRate: 8,
        startAmountInr: 20,
        incrementAmountInr: 10,
        totalPlannedInr: priyaActivePlanned,
        totalSavedInr: priyaSaved,
        completedDays: 6,
        status: 'ACTIVE',
        locked: false,
        simulatedMode: true,
        startDate: priyaActiveStart,
        nextDueDate: today,
        createdAt: `${priyaActiveStart}T08:00:00.000Z`,
        updatedAt: `${today}T08:30:00.000Z`,
      },
      {
        id: 'chl_priya_49d_failed',
        userId: DEMO_SAVER_2_UID,
        planCode: '49D_2PCT',
        durationDays: 49,
        illustrativeBonusRate: 2,
        startAmountInr: 10,
        incrementAmountInr: 10,
        totalPlannedInr: arjunFailedPlanned,
        totalSavedInr: 660,
        completedDays: 11,
        status: 'FAILED',
        locked: true,
        simulatedMode: true,
        startDate: '2026-09-20',
        nextDueDate: '2026-10-01',
        failedReason: 'Missed Day 12 deadline; principal settled back after partner approval.',
        createdAt: '2026-09-20T08:00:00.000Z',
        updatedAt: '2026-10-15T14:20:00.000Z',
      },
    ],
    dailyContributions: arjunContributions,
    streaks: [
      {
        id: 'str_arjun_99d',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_99d_active',
        currentStreak: 12,
        longestStreak: 12,
        lastContributionDate: addDaysIso(today, -1),
        streakBroken: false,
        updatedAt: `${addDaysIso(today, -1)}T09:15:00.000Z`,
      },
      {
        id: 'str_arjun_49f',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_49d_failed',
        currentStreak: 0,
        longestStreak: 15,
        lastContributionDate: addDaysIso(arjunFailedStart, 14),
        streakBroken: true,
        updatedAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'str_arjun_49c',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_49d_completed',
        currentStreak: 49,
        longestStreak: 49,
        lastContributionDate: '2026-08-18',
        streakBroken: false,
        updatedAt: '2026-08-19T11:30:00.000Z',
      },
      {
        id: 'str_priya_364',
        userId: DEMO_SAVER_2_UID,
        challengeId: 'chl_priya_364d_active',
        currentStreak: 6,
        longestStreak: 6,
        lastContributionDate: addDaysIso(today, -1),
        streakBroken: false,
        updatedAt: `${addDaysIso(today, -1)}T08:30:00.000Z`,
      },
    ],
    transactions: arjunTransactions,
    restrictedFundsLedger: [
      {
        id: 'rfl_arjun_49f',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_49d_failed',
        principalBalanceInr: arjunFailedSaved,
        ownershipStatus: 'USER_OWNED_RESTRICTED',
        forfeitureProhibited: true,
        adminSpendProhibited: true,
        legalPartnerReviewStatus: 'PENDING_LEGAL_PARTNER_REVIEW',
        reconciliationNote: 'Awaiting regulated partner settlement authorization.',
        createdAt: '2026-09-17T00:05:00.000Z',
        updatedAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'rfl_priya_49f',
        userId: DEMO_SAVER_2_UID,
        challengeId: 'chl_priya_49d_failed',
        principalBalanceInr: 660,
        ownershipStatus: 'SETTLED_TO_USER',
        forfeitureProhibited: true,
        adminSpendProhibited: true,
        legalPartnerReviewStatus: 'SETTLED',
        reconciliationNote: 'Reconciled and settled under partner approval REF-LEG-2026-088.',
        createdAt: '2026-10-02T00:05:00.000Z',
        updatedAt: '2026-10-15T14:20:00.000Z',
      },
    ],
    settlementRequests: [
      {
        id: 'stl_arjun_49f',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_49d_failed',
        ledgerId: 'rfl_arjun_49f',
        amountInr: arjunFailedSaved,
        status: 'PENDING_LEGAL_PARTNER_REVIEW',
        createdAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'stl_priya_49f',
        userId: DEMO_SAVER_2_UID,
        challengeId: 'chl_priya_49d_failed',
        ledgerId: 'rfl_priya_49f',
        amountInr: 660,
        status: 'SETTLED_REFUNDED',
        legalApprovalRef: 'REF-LEG-2026-088',
        partnerBankRef: 'YESB-ESC-7712',
        transactionRef: 'UTR-SIM-984210',
        approvedBy: 'compliance.admin@demo.jr13.in',
        createdAt: '2026-10-02T00:05:00.000Z',
        settledAt: '2026-10-15T14:20:00.000Z',
      },
    ],
    rewardRecords: [
      {
        id: 'rwd_arjun_49c',
        userId: DEMO_SAVER_UID,
        challengeId: 'chl_arjun_49d_completed',
        eligibleSavingsInr: arjunCompletedPlanned,
        bonusRatePct: 2,
        bonusAmountInr: completedBonus,
        illustrativeOnly: true,
        status: 'CREDITED_SIMULATED',
        createdAt: '2026-08-19T11:30:00.000Z',
      },
    ],
    notifications: [
      {
        id: 'ntf_arjun_1',
        userId: DEMO_SAVER_UID,
        title: 'Day 13 deposit ready',
        message: 'Your scheduled ₹130 simulated deposit for 99-Day Foundation is due today.',
        category: 'DEPOSIT',
        read: false,
        createdAt: `${today}T06:00:00.000Z`,
      },
      {
        id: 'ntf_arjun_2',
        userId: DEMO_SAVER_UID,
        title: 'Restricted balance protected',
        message:
          '₹1,200 from your failed 49-Day Sprint remains 100% user-owned in the Restricted Funds Ledger pending legal/partner review.',
        category: 'SETTLEMENT',
        read: false,
        createdAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'ntf_arjun_3',
        userId: DEMO_SAVER_UID,
        title: '49-Day Sprint completed',
        message:
          'Illustrative 2% completion bonus (₹245) recorded on simulated savings of ₹12,250.',
        category: 'REWARD',
        read: true,
        createdAt: '2026-08-19T11:30:00.000Z',
      },
    ],
    adminUsers: [
      {
        uid: DEMO_ADMIN_UID,
        email: 'compliance.admin@demo.jr13.in',
        role: 'COMPLIANCE_ADMIN',
        active: true,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud_01',
        actorUid: 'system',
        actorRole: 'SYSTEM',
        action: 'CHALLENGE_MARKED_FAILED_LOCKED',
        entityType: 'challenges',
        entityId: 'chl_arjun_49d_failed',
        summary:
          'Challenge locked after missed Day 16 deadline; ₹1,200 moved to user-owned Restricted Funds Ledger without forfeiture.',
        createdAt: '2026-09-17T00:05:00.000Z',
      },
      {
        id: 'aud_02',
        actorUid: DEMO_ADMIN_UID,
        actorRole: 'COMPLIANCE_ADMIN',
        action: 'PARTNER_SETTLEMENT_RECORDED',
        entityType: 'settlementRequests',
        entityId: 'stl_priya_49f',
        summary:
          'Recorded regulated partner approval REF-LEG-2026-088 and settlement UTR-SIM-984210 for ₹660.',
        createdAt: '2026-10-15T14:20:00.000Z',
      },
    ],
    paymentAccounts: [
      {
        id: 'pa_arjun_gpay',
        userId: DEMO_SAVER_UID,
        accountType: 'UPI_VPA',
        holderName: 'Arjun Mehta',
        accountLabel: 'Google Pay Primary',
        upiApp: 'GPAY',
        upiVpaMasked: 'ar••••ta@okicici',
        isPrimary: true,
        simulatedMode: true,
        verificationStatus: 'SIMULATED_VERIFIED',
        createdAt: '2026-07-02T09:00:00.000Z',
        updatedAt: '2026-07-02T09:00:00.000Z',
      },
      {
        id: 'pa_arjun_hdfc',
        userId: DEMO_SAVER_UID,
        accountType: 'BANK_ACCOUNT',
        holderName: 'Arjun Mehta',
        accountLabel: 'HDFC Savings (Settlement Backup)',
        bankName: 'HDFC Bank',
        ifscCode: 'HDFC0000142',
        accountNumberMasked: '••••••••4821',
        accountLast4: '4821',
        isPrimary: false,
        simulatedMode: true,
        verificationStatus: 'SIMULATED_VERIFIED',
        createdAt: '2026-07-05T11:30:00.000Z',
        updatedAt: '2026-07-05T11:30:00.000Z',
      },
      {
        id: 'pa_priya_phonepe',
        userId: DEMO_SAVER_2_UID,
        accountType: 'UPI_VPA',
        holderName: 'Priya Nair',
        accountLabel: 'PhonePe Primary',
        upiApp: 'PHONEPE',
        upiVpaMasked: 'pr••••ir@ybl',
        isPrimary: true,
        simulatedMode: true,
        verificationStatus: 'SIMULATED_VERIFIED',
        createdAt: '2026-09-11T10:15:00.000Z',
        updatedAt: '2026-09-11T10:15:00.000Z',
      },
    ],
  };
}
