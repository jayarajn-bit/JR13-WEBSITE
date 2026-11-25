export type PlanCode = '1D_0PCT' | '49D_2PCT' | '99D_4PCT' | '299D_5PCT' | '364D_8PCT';

export type ChallengeStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export type AdminRole = 'COMPLIANCE_ADMIN' | 'RECONCILIATION_OFFICER' | 'SUPER_ADMIN';

export type UpiAppId = 'GPAY' | 'PHONEPE' | 'PAYTM' | 'BHIM' | 'AMAZON_PAY' | 'OTHER_UPI';

export type PaymentAccountType = 'UPI_VPA' | 'BANK_ACCOUNT';

export interface ChallengePlan {
  code: PlanCode;
  durationDays: 1 | 49 | 99 | 299 | 364;
  illustrativeBonusRate: 0 | 2 | 4 | 5 | 8;
  title: string;
  subtitle: string;
  targetAudience: string;
}

export interface ScheduleDayItem {
  dayNumber: number;
  scheduledDate: string;
  amountInr: number;
  cumulativeInr: number;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  authProvider: 'google' | 'demo';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  fullName: string;
  phoneMasked?: string;
  city?: string;
  state?: string;
  preferredStartInr: number;
  preferredIncrementInr: number;
  preferredUpiApp?: UpiAppId;
  preferredUpiVpaMasked?: string;
  kycSimulationStatus: 'SIMULATED_PENDING' | 'SIMULATED_VERIFIED';
  updatedAt: string;
}

export interface SavingsChallenge {
  id: string;
  userId: string;
  planCode: PlanCode;
  durationDays: 1 | 49 | 99 | 299 | 364;
  illustrativeBonusRate: 0 | 2 | 4 | 5 | 8;
  startAmountInr: number;
  incrementAmountInr: number;
  totalPlannedInr: number;
  totalSavedInr: number;
  completedDays: number;
  status: ChallengeStatus;
  locked: boolean;
  simulatedMode: true;
  startDate: string;
  nextDueDate: string;
  failedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyContribution {
  id: string;
  userId: string;
  challengeId: string;
  dayNumber: number;
  scheduledDate: string;
  amountInr: number;
  status: 'PAID_SIMULATED' | 'MISSED';
  referenceCode: string;
  upiApp?: UpiAppId;
  upiVpaMasked?: string;
  createdAt: string;
}

export interface StreakRecord {
  id: string;
  userId: string;
  challengeId: string;
  currentStreak: number;
  longestStreak: number;
  lastContributionDate?: string;
  streakBroken: boolean;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  challengeId: string;
  txType:
    | 'SIMULATED_DEPOSIT'
    | 'RESTRICTED_HOLD_TRANSFER'
    | 'ILLUSTRATIVE_BONUS_CREDIT'
    | 'APPROVED_REFUND_SETTLEMENT';
  amountInr: number;
  simulated: true;
  referenceId: string;
  reconciliationStatus: 'RECONCILED' | 'PENDING_REVIEW';
  upiApp?: UpiAppId;
  upiVpaMasked?: string;
  description: string;
  createdAt: string;
}

export interface RestrictedFundsEntry {
  id: string;
  userId: string;
  challengeId: string;
  principalBalanceInr: number;
  ownershipStatus: 'USER_OWNED_RESTRICTED' | 'SETTLED_TO_USER';
  forfeitureProhibited: true;
  adminSpendProhibited: true;
  legalPartnerReviewStatus:
    | 'PENDING_LEGAL_PARTNER_REVIEW'
    | 'APPROVED_FOR_SETTLEMENT'
    | 'SETTLED';
  reconciliationNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementRequest {
  id: string;
  userId: string;
  challengeId: string;
  ledgerId: string;
  amountInr: number;
  status: 'PENDING_LEGAL_PARTNER_REVIEW' | 'PARTNER_APPROVED' | 'SETTLED_REFUNDED';
  legalApprovalRef?: string;
  partnerBankRef?: string;
  transactionRef?: string;
  approvedBy?: string;
  createdAt: string;
  settledAt?: string;
}

export interface RewardRecord {
  id: string;
  userId: string;
  challengeId: string;
  eligibleSavingsInr: number;
  bonusRatePct: 0 | 2 | 4 | 5 | 8;
  bonusAmountInr: number;
  illustrativeOnly: true;
  status: 'PROPOSED_ILLUSTRATIVE' | 'CREDITED_SIMULATED';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'DEPOSIT' | 'STREAK' | 'CHALLENGE_FAILED' | 'SETTLEMENT' | 'REWARD';
  read: boolean;
  createdAt: string;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorRole: 'USER' | AdminRole | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface PaymentAccount {
  id: string;
  userId: string;
  accountType: PaymentAccountType;
  holderName: string;
  accountLabel: string;
  upiApp?: UpiAppId;
  upiVpaMasked?: string;
  bankName?: string;
  ifscCode?: string;
  accountNumberMasked?: string;
  accountLast4?: string;
  isPrimary: boolean;
  simulatedMode: true;
  verificationStatus: 'SIMULATED_VERIFIED' | 'PENDING_PARTNER_VERIFICATION';
  createdAt: string;
  updatedAt: string;
}

export interface AppStateSnapshot {
  users: UserAccount[];
  profiles: UserProfile[];
  challenges: SavingsChallenge[];
  dailyContributions: DailyContribution[];
  streaks: StreakRecord[];
  transactions: TransactionRecord[];
  restrictedFundsLedger: RestrictedFundsEntry[];
  settlementRequests: SettlementRequest[];
  rewardRecords: RewardRecord[];
  notifications: AppNotification[];
  adminUsers: AdminUserRecord[];
  auditLogs: AuditLogRecord[];
  paymentAccounts: PaymentAccount[];
}
