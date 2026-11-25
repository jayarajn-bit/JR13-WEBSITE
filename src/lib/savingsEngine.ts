import type { ChallengePlan, DailyContribution, PlanCode, ScheduleDayItem } from '../types/savings';

export const STREAK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface StreakCooldownStatus {
  isLocked: boolean;
  lastContributionAt: string | null;
  nextUnlockAt: string | null;
  remainingMs: number;
}

export function getUserStreakCooldown(
  dailyContributions: DailyContribution[],
  userId: string | null | undefined,
  nowMs: number = Date.now()
): StreakCooldownStatus {
  if (!userId) {
    return {
      isLocked: false,
      lastContributionAt: null,
      nextUnlockAt: null,
      remainingMs: 0,
    };
  }

  let latestMs = -1;
  let latestIso: string | null = null;
  for (const item of dailyContributions) {
    if (item.userId !== userId || item.status !== 'PAID_SIMULATED') continue;
    const parsedMs = Date.parse(item.createdAt);
    if (Number.isFinite(parsedMs) && parsedMs > latestMs) {
      latestMs = parsedMs;
      latestIso = item.createdAt;
    }
  }

  if (latestMs < 0 || !latestIso) {
    return {
      isLocked: false,
      lastContributionAt: null,
      nextUnlockAt: null,
      remainingMs: 0,
    };
  }

  const unlockMs = latestMs + STREAK_COOLDOWN_MS;
  const remainingMs = Math.max(0, unlockMs - nowMs);
  return {
    isLocked: remainingMs > 0,
    lastContributionAt: latestIso,
    nextUnlockAt: new Date(unlockMs).toISOString(),
    remainingMs,
  };
}

export function formatRemainingCooldown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export interface MissedDeadlineCauseOption {
  code: string;
  label: string;
  description: string;
}

export const MISSED_DEADLINE_CAUSES: MissedDeadlineCauseOption[] = [
  {
    code: 'MISSED_DAILY_DEADLINE',
    label: 'Missed Daily Deposit Deadline',
    description: 'Scheduled daily INR contribution was not completed before the daily cutoff.',
  },
  {
    code: 'STREAK_WINDOW_EXPIRED',
    label: '24-Hour Streak Window Expired',
    description: 'Next daily streak window elapsed after 24 hours without a deposit.',
  },
  {
    code: 'UPI_PAYMENT_NOT_COMPLETED',
    label: 'UPI Payment Not Completed',
    description: 'Simulated UPI/bank deposit was cancelled or timed out before deadline.',
  },
  {
    code: 'VOLUNTARY_PAUSE',
    label: 'Voluntary Pause / Cutoff Missed',
    description: 'Saver paused or skipped scheduled day; principal preserved in restricted ledger.',
  },
];

export function getChallengeDescription(challenge: {
  planCode: PlanCode;
  durationDays: number;
  startAmountInr: number;
  incrementAmountInr: number;
  completedDays: number;
  illustrativeBonusRate: number;
}): string {
  const planTitle = CHALLENGE_PLANS.find((p) => p.code === challenge.planCode)?.title || challenge.planCode;
  return `${planTitle} · Day ${challenge.completedDays}/${challenge.durationDays} · Start ₹${challenge.startAmountInr} (+₹${challenge.incrementAmountInr}/day)${
    challenge.illustrativeBonusRate > 0 ? ` · ${challenge.illustrativeBonusRate}% illustrative bonus` : ' · 1-day streak'
  }`;
}

export function getChallengeFailureCause(failedReason?: string): string {
  const clean = (failedReason || '').trim();
  return clean || 'Missed daily deposit deadline (principal preserved in Restricted Funds Ledger).';
}

export const CHALLENGE_PLANS: ChallengePlan[] = [
  {
    code: '1D_0PCT',
    durationDays: 1,
    illustrativeBonusRate: 0,
    title: '1-Day Streak',
    subtitle: 'Single-day 1-streak savings sprint (1 day only)',
    targetAudience: 'One-day quick savers',
  },
  {
    code: '49D_2PCT',
    durationDays: 49,
    illustrativeBonusRate: 2,
    title: '49-Day Sprint',
    subtitle: '7-week disciplined daily habit starter',
    targetAudience: 'First-time daily savers',
  },
  {
    code: '99D_4PCT',
    durationDays: 99,
    illustrativeBonusRate: 4,
    title: '99-Day Foundation',
    subtitle: 'Quarterly progressive savings builder',
    targetAudience: 'Consistent habit builders',
  },
  {
    code: '299D_5PCT',
    durationDays: 299,
    illustrativeBonusRate: 5,
    title: '299-Day Horizon',
    subtitle: 'Extended milestone reserve challenge',
    targetAudience: 'Medium-term goal planners',
  },
  {
    code: '364D_8PCT',
    durationDays: 364,
    illustrativeBonusRate: 8,
    title: '364-Day Sovereign',
    subtitle: 'Full 52-week progressive discipline',
    targetAudience: 'Long-term wealth discipline',
  },
];

export function getPlanByCode(code: PlanCode): ChallengePlan {
  const found = CHALLENGE_PLANS.find((plan) => plan.code === code);
  if (!found) {
    throw new Error(`Unknown challenge plan code: ${code}`);
  }
  return found;
}

export function formatINR(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function getDayAmountInr(
  dayNumber: number,
  startAmountInr: number,
  incrementAmountInr: number
): number {
  if (dayNumber < 1) return 0;
  return startAmountInr + (dayNumber - 1) * incrementAmountInr;
}

export function calculateTotalPlannedInr(
  durationDays: number,
  startAmountInr: number,
  incrementAmountInr: number
): number {
  return (durationDays / 2) * (2 * startAmountInr + (durationDays - 1) * incrementAmountInr);
}

export function calculateIllustrativeBonusInr(
  eligibleSavingsInr: number,
  bonusRatePct: number
): number {
  return Math.round(((eligibleSavingsInr * bonusRatePct) / 100) * 100) / 100;
}

export function addDaysIso(isoDate: string, daysToAdd: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export function generateFullSchedule(
  durationDays: number,
  startAmountInr: number,
  incrementAmountInr: number,
  startDateIso: string
): ScheduleDayItem[] {
  const items: ScheduleDayItem[] = [];
  let cumulative = 0;
  for (let day = 1; day <= durationDays; day += 1) {
    const amountInr = getDayAmountInr(day, startAmountInr, incrementAmountInr);
    cumulative += amountInr;
    items.push({
      dayNumber: day,
      scheduledDate: addDaysIso(startDateIso, day - 1),
      amountInr,
      cumulativeInr: cumulative,
    });
  }
  return items;
}

export function makeId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export function makeRef(prefix: string): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
}

export const REGULATORY_DISCLOSURE =
  'Simulated Environment Notice: All deposits, streaks, and ledgers shown in JR13 SAVINGS are simulated records only. JR13 SAVINGS does not collect, hold, transfer, or pay real money until Indian legal and regulatory review is completed and an authorized regulated bank or payment partner approves the full flow. All completion bonus rates (2%, 4%, 5%, 8%) are proposed illustrative rates only and are not guaranteed returns or deposit interest.';
