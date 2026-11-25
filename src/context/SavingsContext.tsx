import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  addDaysIso,
  calculateIllustrativeBonusInr,
  calculateTotalPlannedInr,
  formatRemainingCooldown,
  getDayAmountInr,
  getPlanByCode,
  getUserStreakCooldown,
  makeId,
  makeRef,
} from '../lib/savingsEngine';
import { buildInitialDemoState, DEMO_ADMIN_UID, DEMO_SAVER_UID } from '../lib/demoSeed';
import {
  getUpiAppOption,
  isValidBankAccountNumber,
  isValidIfscCode,
  isValidUpiVpa,
  maskBankAccountNumber,
  maskUpiVpa,
  normalizeIfscCode,
} from '../lib/upiGateway';
import type {
  AdminRole,
  AppNotification,
  AppStateSnapshot,
  AuditLogRecord,
  DailyContribution,
  PaymentAccount,
  PaymentAccountType,
  PlanCode,
  RestrictedFundsEntry,
  RewardRecord,
  SavingsChallenge,
  SettlementRequest,
  StreakRecord,
  TransactionRecord,
  UpiAppId,
  UserAccount,
  UserProfile,
} from '../types/savings';

export type AuthMode = 'unauthenticated' | 'demo' | 'firebase';

export interface StartChallengeInput {
  planCode: PlanCode;
  startAmountInr: number;
  incrementAmountInr: number;
  startDate: string;
}

export interface UpiPaymentInput {
  upiApp: UpiAppId;
  upiVpa?: string;
}

export interface PartnerSettlementApprovalInput {
  legalApprovalRef: string;
  partnerBankRef: string;
  transactionRef: string;
}

export interface RegisterPaymentAccountInput {
  accountType: PaymentAccountType;
  holderName: string;
  accountLabel: string;
  upiApp?: UpiAppId;
  upiVpa?: string;
  bankName?: string;
  ifscCode?: string;
  accountNumber?: string;
  setAsPrimary?: boolean;
}

interface SavingsContextValue {
  authMode: AuthMode;
  authReady: boolean;
  firebaseUser: FirebaseUser | null;
  currentUid: string | null;
  currentUser: UserAccount | null;
  currentProfile: UserProfile | null;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  state: AppStateSnapshot;
  actionBusy: boolean;
  statusBanner: { type: 'success' | 'error' | 'info'; text: string } | null;
  clearBanner: () => void;
  signInWithGoogle: () => Promise<boolean>;
  enterDemoSession: (role: 'saver' | 'saver2' | 'admin') => void;
  registerDemoAccount: (fullName: string, email: string, city: string, stateName: string) => void;
  logout: () => Promise<void>;
  resetDemoWorkspace: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  startChallenge: (input: StartChallengeInput) => Promise<SavingsChallenge>;
  recordDailyContribution: (challengeId: string, upiPayment?: UpiPaymentInput) => Promise<void>;
  simulateMissedDeadline: (challengeId: string, cause?: string, description?: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  registerPaymentAccount: (input: RegisterPaymentAccountInput) => Promise<PaymentAccount>;
  setPrimaryPaymentAccount: (accountId: string) => Promise<void>;
  removePaymentAccount: (accountId: string) => Promise<void>;
  reconcileTransaction: (transactionId: string) => Promise<void>;
  addLedgerReconciliationNote: (ledgerId: string, note: string) => Promise<void>;
  approveAndRecordPartnerSettlement: (
    settlementId: string,
    approval: PartnerSettlementApprovalInput
  ) => Promise<void>;
  toggleUserStatus: (targetUid: string, nextStatus: 'ACTIVE' | 'SUSPENDED') => Promise<void>;
}

const SavingsContext = createContext<SavingsContextValue | null>(null);

const EMPTY_STATE: AppStateSnapshot = {
  users: [],
  profiles: [],
  challenges: [],
  dailyContributions: [],
  streaks: [],
  transactions: [],
  restrictedFundsLedger: [],
  settlementRequests: [],
  rewardRecords: [],
  notifications: [],
  adminUsers: [],
  auditLogs: [],
  paymentAccounts: [],
};

export function SavingsProvider({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>('unauthenticated');
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [demoUid, setDemoUid] = useState<string>(DEMO_SAVER_UID);
  const [demoState, setDemoState] = useState<AppStateSnapshot>(() => buildInitialDemoState());
  const [fireState, setFireState] = useState<AppStateSnapshot>(EMPTY_STATE);
  const [firestoreAdminRole, setFirestoreAdminRole] = useState<AdminRole | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const clearBanner = () => setStatusBanner(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setAuthMode('firebase');
        await bootstrapFirebaseUser(fbUser);
      } else {
        setFirestoreAdminRole(null);
        setFireState(EMPTY_STATE);
        setAuthMode((prev) => (prev === 'demo' ? prev : 'unauthenticated'));
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  async function bootstrapFirebaseUser(fbUser: FirebaseUser) {
    const now = new Date().toISOString();
    const userRef = doc(db, 'users', fbUser.uid);
    const profileRef = doc(db, 'profiles', fbUser.uid);

    try {
      const existingUser = await getDoc(userRef);
      if (!existingUser.exists()) {
        const userDoc: UserAccount = {
          uid: fbUser.uid,
          email: fbUser.email || `${fbUser.uid}@users.jr13.in`,
          displayName: fbUser.displayName || 'JR13 Saver',
          authProvider: 'google',
          accountStatus: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userRef, userDoc);
      }

      const existingProfile = await getDoc(profileRef);
      if (!existingProfile.exists()) {
        const profileDoc: UserProfile = {
          userId: fbUser.uid,
          fullName: fbUser.displayName || 'JR13 Saver',
          phoneMasked: '+91 90••••0000',
          city: 'Mumbai',
          state: 'Maharashtra',
          preferredStartInr: 10,
          preferredIncrementInr: 10,
          kycSimulationStatus: 'SIMULATED_VERIFIED',
          updatedAt: now,
        };
        await setDoc(profileRef, profileDoc);
      }

      if (
        fbUser.emailVerified &&
        fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      ) {
        setFirestoreAdminRole('SUPER_ADMIN');
      } else {
        try {
          const adminSnap = await getDoc(doc(db, 'adminUsers', fbUser.uid));
          if (adminSnap.exists() && adminSnap.data().active) {
            setFirestoreAdminRole(adminSnap.data().role as AdminRole);
          } else {
            setFirestoreAdminRole(null);
          }
        } catch {
          setFirestoreAdminRole(null);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
    }
  }

  const isFirebaseAdmin = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      (firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() ||
        firestoreAdminRole !== null)
  );

  // Attach Firestore realtime listeners only when signed in with Google
  useEffect(() => {
    if (authMode !== 'firebase' || !firebaseUser) {
      return;
    }

    const uid = firebaseUser.uid;
    const unsubs: Unsubscribe[] = [];

    const bindCollection = <T,>(
      colName: string,
      key: keyof AppStateSnapshot,
      ownerField: string | null = 'userId'
    ) => {
      const colRef = collection(db, colName);
      const q =
        isFirebaseAdmin || ownerField === null
          ? colRef
          : query(colRef, where(ownerField, '==', uid));

      const unsub = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => d.data() as T);
          setFireState((prev) => ({ ...prev, [key]: rows }));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    bindCollection<UserAccount>('users', 'users', 'uid');
    bindCollection<UserProfile>('profiles', 'profiles', 'userId');
    bindCollection<SavingsChallenge>('challenges', 'challenges', 'userId');
    bindCollection<DailyContribution>('dailyContributions', 'dailyContributions', 'userId');
    bindCollection<StreakRecord>('streaks', 'streaks', 'userId');
    bindCollection<TransactionRecord>('transactions', 'transactions', 'userId');
    bindCollection<RestrictedFundsEntry>(
      'restrictedFundsLedger',
      'restrictedFundsLedger',
      'userId'
    );
    bindCollection<SettlementRequest>('settlementRequests', 'settlementRequests', 'userId');
    bindCollection<RewardRecord>('rewardRecords', 'rewardRecords', 'userId');
    bindCollection<AppNotification>('notifications', 'notifications', 'userId');
    bindCollection<PaymentAccount>('paymentAccounts', 'paymentAccounts', 'userId');
    bindCollection<AuditLogRecord>('auditLogs', 'auditLogs', isFirebaseAdmin ? null : 'actorUid');

    if (isFirebaseAdmin) {
      bindCollection('adminUsers', 'adminUsers', null);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authMode, firebaseUser, isFirebaseAdmin]);

  const activeState = authMode === 'firebase' ? fireState : demoState;
  const currentUid =
    authMode === 'firebase'
      ? firebaseUser?.uid || null
      : authMode === 'demo'
        ? demoUid
        : null;

  const isAdmin = useMemo(() => {
    if (authMode === 'firebase') return isFirebaseAdmin;
    if (authMode === 'demo') return demoUid === DEMO_ADMIN_UID;
    return false;
  }, [authMode, isFirebaseAdmin, demoUid]);

  const adminRole: AdminRole | null = useMemo(() => {
    if (!isAdmin) return null;
    if (authMode === 'firebase') return firestoreAdminRole || 'SUPER_ADMIN';
    return 'COMPLIANCE_ADMIN';
  }, [isAdmin, authMode, firestoreAdminRole]);

  const currentUser: UserAccount | null = useMemo(() => {
    if (!currentUid) return null;
    if (authMode === 'demo' && currentUid === DEMO_ADMIN_UID) {
      return {
        uid: DEMO_ADMIN_UID,
        email: 'compliance.admin@demo.jr13.in',
        displayName: 'Kavita Deshmukh (Compliance)',
        authProvider: 'demo',
        accountStatus: 'ACTIVE',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
      };
    }
    return activeState.users.find((u) => u.uid === currentUid) || null;
  }, [activeState.users, authMode, currentUid]);

  const currentProfile: UserProfile | null = useMemo(() => {
    if (!currentUid) return null;
    return activeState.profiles.find((p) => p.userId === currentUid) || null;
  }, [activeState.profiles, currentUid]);

  async function signInWithGoogle(): Promise<boolean> {
    setActionBusy(true);
    setStatusBanner(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      setStatusBanner({
        type: 'success',
        text: 'Signed in with Google OAuth. Live Firestore workspace synchronized.',
      });
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Google OAuth sign-in was cancelled or failed.';
      setStatusBanner({ type: 'error', text: msg });
      return false;
    } finally {
      setActionBusy(false);
    }
  }

  function enterDemoSession(role: 'saver' | 'saver2' | 'admin') {
    setAuthMode('demo');
    if (role === 'saver') setDemoUid(DEMO_SAVER_UID);
    else if (role === 'saver2') setDemoUid('demo_saver_priya');
    else setDemoUid(DEMO_ADMIN_UID);
    setStatusBanner({
      type: 'info',
      text:
        role === 'admin'
          ? 'Demo Compliance Admin session active. Restricted-funds spending remains locked by policy.'
          : 'Interactive Demo Saver workspace active (simulated INR mode).',
    });
  }

  function registerDemoAccount(
    fullName: string,
    email: string,
    city: string,
    stateName: string
  ) {
    const cleanName = fullName.trim() || 'New JR13 Saver';
    const cleanEmail = email.trim().toLowerCase() || `saver_${Date.now()}@demo.jr13.in`;
    const newUid = makeId('demo_user');
    const now = new Date().toISOString();

    const newUser: UserAccount = {
      uid: newUid,
      email: cleanEmail,
      displayName: cleanName,
      authProvider: 'demo',
      accountStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const newProfile: UserProfile = {
      userId: newUid,
      fullName: cleanName,
      phoneMasked: '+91 99••••1300',
      city: city.trim() || 'Pune',
      state: stateName.trim() || 'Maharashtra',
      preferredStartInr: 10,
      preferredIncrementInr: 10,
      kycSimulationStatus: 'SIMULATED_VERIFIED',
      updatedAt: now,
    };
    const welcomeNotif: AppNotification = {
      id: makeId('ntf'),
      userId: newUid,
      title: 'Welcome to JR13 SAVINGS',
      message: 'Select a 1, 49, 99, 299, or 364-day challenge to preview your full INR deposit schedule.',
      category: 'STREAK',
      read: false,
      createdAt: now,
    };

    setDemoState((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
      profiles: [newProfile, ...prev.profiles],
      notifications: [welcomeNotif, ...prev.notifications],
    }));
    setAuthMode('demo');
    setDemoUid(newUid);
    setStatusBanner({
      type: 'success',
      text: `Demo profile created for ${cleanName}. Choose a savings challenge to begin.`,
    });
  }

  async function logout() {
    if (authMode === 'firebase') {
      await signOut(auth);
    }
    setAuthMode('unauthenticated');
    setStatusBanner(null);
  }

  function resetDemoWorkspace() {
    setDemoState(buildInitialDemoState());
    setDemoUid(DEMO_SAVER_UID);
    setAuthMode('demo');
    setStatusBanner({
      type: 'info',
      text: 'Demo workspace restored to initial sample accounts and ledger state.',
    });
  }

  async function updateProfile(patch: Partial<UserProfile>) {
    if (!currentUid) return;
    setActionBusy(true);
    const now = new Date().toISOString();
    try {
      if (authMode === 'firebase') {
        const profileRef = doc(db, 'profiles', currentUid);
        await updateDoc(profileRef, { ...patch, updatedAt: now });
      } else {
        setDemoState((prev) => ({
          ...prev,
          profiles: prev.profiles.map((p) =>
            p.userId === currentUid ? { ...p, ...patch, updatedAt: now } : p
          ),
          users: patch.fullName
            ? prev.users.map((u) =>
                u.uid === currentUid
                  ? { ...u, displayName: patch.fullName || u.displayName, updatedAt: now }
                  : u
              )
            : prev.users,
        }));
      }
      setStatusBanner({ type: 'success', text: 'Profile and schedule defaults saved.' });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${currentUid}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function startChallenge(input: StartChallengeInput): Promise<SavingsChallenge> {
    if (!currentUid) throw new Error('Sign in required to start a challenge.');
    if (input.startAmountInr < 10 || input.incrementAmountInr < 5) {
      throw new Error('Minimum Day 1 deposit is ₹10 and minimum daily increment is ₹5.');
    }

    setActionBusy(true);
    const plan = getPlanByCode(input.planCode);
    const now = new Date().toISOString();
    const challengeId = makeId('chl');
    const streakId = makeId('str');
    const notifId = makeId('ntf');
    const auditId = makeId('aud');
    const totalPlannedInr = calculateTotalPlannedInr(
      plan.durationDays,
      input.startAmountInr,
      input.incrementAmountInr
    );

    const challenge: SavingsChallenge = {
      id: challengeId,
      userId: currentUid,
      planCode: plan.code,
      durationDays: plan.durationDays,
      illustrativeBonusRate: plan.illustrativeBonusRate,
      startAmountInr: input.startAmountInr,
      incrementAmountInr: input.incrementAmountInr,
      totalPlannedInr,
      totalSavedInr: 0,
      completedDays: 0,
      status: 'ACTIVE',
      locked: false,
      simulatedMode: true,
      startDate: input.startDate,
      nextDueDate: input.startDate,
      createdAt: now,
      updatedAt: now,
    };

    const streak: StreakRecord = {
      id: streakId,
      userId: currentUid,
      challengeId,
      currentStreak: 0,
      longestStreak: 0,
      streakBroken: false,
      updatedAt: now,
    };

    const notification: AppNotification = {
      id: notifId,
      userId: currentUid,
      title: `${plan.title} enrolled (Simulated)`,
      message: `Day 1 deposit of ₹${input.startAmountInr} scheduled for ${input.startDate}.`,
      category: 'STREAK',
      read: false,
      createdAt: now,
    };

    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: isAdmin ? adminRole || 'COMPLIANCE_ADMIN' : 'USER',
      action: 'CHALLENGE_ENROLLED',
      entityType: 'challenges',
      entityId: challengeId,
      summary: `Started ${plan.durationDays}-day simulated challenge (${plan.illustrativeBonusRate}% illustrative bonus rate).`,
      createdAt: now,
    };

    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        batch.set(doc(db, 'challenges', challengeId), challenge);
        batch.set(doc(db, 'streaks', streakId), streak);
        batch.set(doc(db, 'notifications', notifId), notification);
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          challenges: [challenge, ...prev.challenges],
          streaks: [streak, ...prev.streaks],
          notifications: [notification, ...prev.notifications],
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }
      setStatusBanner({
        type: 'success',
        text: `Enrolled in ${plan.title} (${plan.durationDays} days). Ready for Day 1 simulated deposit.`,
      });
      return challenge;
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.WRITE, `challenges/${challengeId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function recordDailyContribution(challengeId: string, upiPayment?: UpiPaymentInput) {
    if (!currentUid) return;
    const challenge = activeState.challenges.find((c) => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found.');
    if (challenge.locked || challenge.status !== 'ACTIVE') {
      throw new Error('This challenge is locked. Contributions are disabled.');
    }

    const cooldown = getUserStreakCooldown(activeState.dailyContributions, challenge.userId);
    if (cooldown.isLocked) {
      const msg = `Only 1 streak per day is allowed. Next streak starts after 24 hours (${formatRemainingCooldown(
        cooldown.remainingMs
      )} remaining).`;
      setStatusBanner({ type: 'error', text: msg });
      throw new Error(msg);
    }

    setActionBusy(true);
    const now = new Date().toISOString();
    const nextDay = challenge.completedDays + 1;
    const amountInr = getDayAmountInr(
      nextDay,
      challenge.startAmountInr,
      challenge.incrementAmountInr
    );
    const scheduledDate = addDaysIso(challenge.startDate, nextDay - 1);
    const isCompleting = nextDay >= challenge.durationDays;
    const newTotalSaved = challenge.totalSavedInr + amountInr;
    const refCode = makeRef(upiPayment ? 'SIM-UPI' : 'SIM-DEP');
    const contribId = makeId('contrib');
    const txId = makeId('tx');
    const notifId = makeId('ntf');
    const auditId = makeId('aud');

    const upiLabel = upiPayment ? getUpiAppOption(upiPayment.upiApp).name : null;
    const maskedVpa =
      upiPayment?.upiVpa && upiPayment.upiVpa.trim()
        ? maskUpiVpa(upiPayment.upiVpa)
        : undefined;

    const newContribution: DailyContribution = {
      id: contribId,
      userId: challenge.userId,
      challengeId,
      dayNumber: nextDay,
      scheduledDate,
      amountInr,
      status: 'PAID_SIMULATED',
      referenceCode: refCode,
      ...(upiPayment ? { upiApp: upiPayment.upiApp } : {}),
      ...(maskedVpa ? { upiVpaMasked: maskedVpa } : {}),
      createdAt: now,
    };

    const newTx: TransactionRecord = {
      id: txId,
      userId: challenge.userId,
      challengeId,
      txType: 'SIMULATED_DEPOSIT',
      amountInr,
      simulated: true,
      referenceId: refCode,
      reconciliationStatus: 'RECONCILED',
      ...(upiPayment ? { upiApp: upiPayment.upiApp } : {}),
      ...(maskedVpa ? { upiVpaMasked: maskedVpa } : {}),
      description: upiLabel
        ? `Day ${nextDay} simulated ${upiLabel} UPI deposit (${challenge.durationDays}d)`
        : `Day ${nextDay} simulated deposit for ${challenge.durationDays}-day challenge`,
      createdAt: now,
    };

    const streakRecord = activeState.streaks.find((s) => s.challengeId === challengeId);
    const nextCurrentStreak = (streakRecord?.currentStreak || 0) + 1;
    const nextLongestStreak = Math.max(streakRecord?.longestStreak || 0, nextCurrentStreak);

    const updatedChallengeFields = {
      completedDays: nextDay,
      totalSavedInr: newTotalSaved,
      status: isCompleting ? ('COMPLETED' as const) : ('ACTIVE' as const),
      locked: isCompleting,
      nextDueDate: isCompleting ? scheduledDate : addDaysIso(challenge.startDate, nextDay),
      updatedAt: now,
    };

    let rewardRecord: RewardRecord | null = null;
    let rewardTx: TransactionRecord | null = null;
    if (isCompleting && challenge.illustrativeBonusRate > 0) {
      const bonusAmount = calculateIllustrativeBonusInr(
        newTotalSaved,
        challenge.illustrativeBonusRate
      );
      rewardRecord = {
        id: makeId('rwd'),
        userId: challenge.userId,
        challengeId,
        eligibleSavingsInr: newTotalSaved,
        bonusRatePct: challenge.illustrativeBonusRate,
        bonusAmountInr: bonusAmount,
        illustrativeOnly: true,
        status: 'CREDITED_SIMULATED',
        createdAt: now,
      };
      rewardTx = {
        id: makeId('tx'),
        userId: challenge.userId,
        challengeId,
        txType: 'ILLUSTRATIVE_BONUS_CREDIT',
        amountInr: bonusAmount,
        simulated: true,
        referenceId: makeRef('BON-ILL'),
        reconciliationStatus: 'RECONCILED',
        description: `${challenge.illustrativeBonusRate}% proposed illustrative one-time completion bonus (simulated)`,
        createdAt: now,
      };
    }

    const notification: AppNotification = {
      id: notifId,
      userId: challenge.userId,
      title: isCompleting
        ? challenge.durationDays === 1
          ? '1-Day Streak Completed'
          : `${challenge.durationDays}-Day Challenge Completed`
        : `Day ${nextDay} deposit recorded`,
      message: isCompleting
        ? rewardRecord
          ? `All ${challenge.durationDays} days saved (₹${newTotalSaved.toLocaleString('en-IN')}). Illustrative ${challenge.illustrativeBonusRate}% completion bonus (₹${rewardRecord.bonusAmountInr.toLocaleString('en-IN')}) logged.`
          : `Single-day deposit saved (₹${newTotalSaved.toLocaleString('en-IN')}). 1-day streak completed.`
        : `₹${amountInr.toLocaleString('en-IN')} simulated deposit logged. Streak is now ${nextCurrentStreak} days.`,
      category: isCompleting ? (rewardRecord ? 'REWARD' : 'STREAK') : 'DEPOSIT',
      read: false,
      createdAt: now,
    };

    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: 'USER',
      action: isCompleting
        ? rewardRecord
          ? 'CHALLENGE_COMPLETED_BONUS_LOGGED'
          : 'CHALLENGE_COMPLETED_1DAY_STREAK'
        : 'DAILY_CONTRIBUTION_RECORDED',
      entityType: 'challenges',
      entityId: challengeId,
      summary: `Day ${nextDay} simulated deposit ₹${amountInr} recorded (${refCode}).`,
      createdAt: now,
    };

    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', challengeId), updatedChallengeFields);
        batch.set(doc(db, 'dailyContributions', contribId), newContribution);
        batch.set(doc(db, 'transactions', txId), newTx);
        if (streakRecord) {
          batch.update(doc(db, 'streaks', streakRecord.id), {
            currentStreak: nextCurrentStreak,
            longestStreak: nextLongestStreak,
            lastContributionDate: scheduledDate,
            streakBroken: false,
            updatedAt: now,
          });
        }
        if (rewardRecord && rewardTx) {
          batch.set(doc(db, 'rewardRecords', rewardRecord.id), rewardRecord);
          batch.set(doc(db, 'transactions', rewardTx.id), rewardTx);
        }
        batch.set(doc(db, 'notifications', notifId), notification);
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          challenges: prev.challenges.map((c) =>
            c.id === challengeId ? { ...c, ...updatedChallengeFields } : c
          ),
          dailyContributions: [...prev.dailyContributions, newContribution],
          streaks: prev.streaks.map((s) =>
            s.challengeId === challengeId
              ? {
                  ...s,
                  currentStreak: nextCurrentStreak,
                  longestStreak: nextLongestStreak,
                  lastContributionDate: scheduledDate,
                  streakBroken: false,
                  updatedAt: now,
                }
              : s
          ),
          transactions: [
            ...(rewardTx ? [rewardTx] : []),
            newTx,
            ...prev.transactions,
          ],
          rewardRecords: rewardRecord
            ? [rewardRecord, ...prev.rewardRecords]
            : prev.rewardRecords,
          notifications: [notification, ...prev.notifications],
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }
      setStatusBanner({
        type: 'success',
        text: isCompleting
          ? rewardRecord
            ? `Challenge completed! Simulated savings ₹${newTotalSaved.toLocaleString('en-IN')} + illustrative bonus ₹${rewardRecord.bonusAmountInr.toLocaleString('en-IN')} recorded.`
            : `1-Day Streak completed! Simulated savings ₹${newTotalSaved.toLocaleString('en-IN')} recorded.`
          : `Day ${nextDay} simulated deposit of ₹${amountInr.toLocaleString('en-IN')} recorded (${refCode}).`,
      });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.WRITE, `challenges/${challengeId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function simulateMissedDeadline(challengeId: string, cause?: string, description?: string) {
    if (!currentUid) return;
    const challenge = activeState.challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== 'ACTIVE') return;

    setActionBusy(true);
    const now = new Date().toISOString();
    const missedDay = challenge.completedDays + 1;
    const cleanCause = (cause || '').trim();
    const cleanDesc = (description || '').trim();
    const combinedCause = cleanCause && cleanDesc
      ? `${cleanCause}: ${cleanDesc}`
      : cleanCause || cleanDesc || `Missed Day ${missedDay} deposit deadline. Challenge locked; customer balance preserved in Restricted Funds Ledger.`;
    const failedReason = combinedCause.slice(0, 240);

    const ledgerId = makeId('rfl');
    const settlementId = makeId('stl');
    const txId = makeId('tx');
    const notifId = makeId('ntf');
    const auditId = makeId('aud');
    const streakRecord = activeState.streaks.find((s) => s.challengeId === challengeId);

    const ledgerEntry: RestrictedFundsEntry | null =
      challenge.totalSavedInr > 0
        ? {
            id: ledgerId,
            userId: challenge.userId,
            challengeId,
            principalBalanceInr: challenge.totalSavedInr,
            ownershipStatus: 'USER_OWNED_RESTRICTED',
            forfeitureProhibited: true,
            adminSpendProhibited: true,
            legalPartnerReviewStatus: 'PENDING_LEGAL_PARTNER_REVIEW',
            reconciliationNote: `Cause: ${failedReason}`.slice(0, 300),
            createdAt: now,
            updatedAt: now,
          }
        : null;

    const settlementReq: SettlementRequest | null =
      challenge.totalSavedInr > 0
        ? {
            id: settlementId,
            userId: challenge.userId,
            challengeId,
            ledgerId,
            amountInr: challenge.totalSavedInr,
            status: 'PENDING_LEGAL_PARTNER_REVIEW',
            createdAt: now,
          }
        : null;

    const holdTx: TransactionRecord | null =
      challenge.totalSavedInr > 0
        ? {
            id: txId,
            userId: challenge.userId,
            challengeId,
            txType: 'RESTRICTED_HOLD_TRANSFER',
            amountInr: challenge.totalSavedInr,
            simulated: true,
            referenceId: makeRef('RST-HOLD'),
            reconciliationStatus: 'RECONCILED',
            description: `Preserved ₹${challenge.totalSavedInr.toLocaleString('en-IN')} in Restricted Funds Ledger after missed Day ${missedDay} deadline`,
            createdAt: now,
          }
        : null;

    const notification: AppNotification = {
      id: notifId,
      userId: challenge.userId,
      title: 'Challenge Marked FAILED & Locked',
      message:
        challenge.totalSavedInr > 0
          ? `Day ${missedDay} deadline missed. ₹${challenge.totalSavedInr.toLocaleString('en-IN')} remains 100% yours in the Restricted Funds Ledger pending legal/partner review. You may start a new challenge anytime.`
          : `Day ${missedDay} deadline missed. Challenge locked with ₹0 balance. You may start a new challenge anytime.`,
      category: 'CHALLENGE_FAILED',
      read: false,
      createdAt: now,
    };

    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: isAdmin ? adminRole || 'COMPLIANCE_ADMIN' : 'USER',
      action: 'CHALLENGE_FAILED_RESTRICTED_PRESERVED',
      entityType: 'challenges',
      entityId: challengeId,
      summary: `Challenge locked on Day ${missedDay} miss. ₹${challenge.totalSavedInr} moved to Restricted Funds Ledger (no forfeiture).`,
      createdAt: now,
    };

    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', challengeId), {
          status: 'FAILED',
          locked: true,
          failedReason,
          updatedAt: now,
        });
        if (streakRecord) {
          batch.update(doc(db, 'streaks', streakRecord.id), {
            currentStreak: 0,
            streakBroken: true,
            updatedAt: now,
          });
        }
        if (ledgerEntry) batch.set(doc(db, 'restrictedFundsLedger', ledgerId), ledgerEntry);
        if (settlementReq) batch.set(doc(db, 'settlementRequests', settlementId), settlementReq);
        if (holdTx) batch.set(doc(db, 'transactions', txId), holdTx);
        batch.set(doc(db, 'notifications', notifId), notification);
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          challenges: prev.challenges.map((c) =>
            c.id === challengeId
              ? { ...c, status: 'FAILED', locked: true, failedReason, updatedAt: now }
              : c
          ),
          streaks: prev.streaks.map((s) =>
            s.challengeId === challengeId
              ? { ...s, currentStreak: 0, streakBroken: true, updatedAt: now }
              : s
          ),
          restrictedFundsLedger: ledgerEntry
            ? [ledgerEntry, ...prev.restrictedFundsLedger]
            : prev.restrictedFundsLedger,
          settlementRequests: settlementReq
            ? [settlementReq, ...prev.settlementRequests]
            : prev.settlementRequests,
          transactions: holdTx ? [holdTx, ...prev.transactions] : prev.transactions,
          notifications: [notification, ...prev.notifications],
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }
      setStatusBanner({
        type: 'info',
        text: `Challenge marked FAILED & locked. ₹${challenge.totalSavedInr.toLocaleString('en-IN')} preserved under your ownership in Restricted Funds Ledger.`,
      });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.WRITE, `challenges/${challengeId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (authMode === 'firebase') {
      try {
        await updateDoc(doc(db, 'notifications', notificationId), { read: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
      }
    } else {
      setDemoState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
      }));
    }
  }

  async function reconcileTransaction(transactionId: string) {
    if (!isAdmin || !currentUid) throw new Error('Admin privilege required.');
    const now = new Date().toISOString();
    const auditId = makeId('aud');
    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: adminRole || 'COMPLIANCE_ADMIN',
      action: 'TRANSACTION_RECONCILED',
      entityType: 'transactions',
      entityId: transactionId,
      summary: `Admin marked transaction ${transactionId} as RECONCILED.`,
      createdAt: now,
    };
    if (authMode === 'firebase') {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'transactions', transactionId), {
          reconciliationStatus: 'RECONCILED',
        });
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${transactionId}`);
      }
    } else {
      setDemoState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === transactionId ? { ...t, reconciliationStatus: 'RECONCILED' } : t
        ),
        auditLogs: [audit, ...prev.auditLogs],
      }));
    }
    setStatusBanner({ type: 'success', text: 'Transaction marked RECONCILED with audit log.' });
  }

  async function addLedgerReconciliationNote(ledgerId: string, note: string) {
    if (!isAdmin || !currentUid) throw new Error('Admin privilege required.');
    const cleanNote = note.trim();
    if (!cleanNote) return;
    const now = new Date().toISOString();
    const auditId = makeId('aud');
    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: adminRole || 'COMPLIANCE_ADMIN',
      action: 'RESTRICTED_LEDGER_RECONCILED',
      entityType: 'restrictedFundsLedger',
      entityId: ledgerId,
      summary: `Admin added reconciliation note on ${ledgerId}: ${cleanNote.slice(0, 120)}`,
      createdAt: now,
    };

    if (authMode === 'firebase') {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'restrictedFundsLedger', ledgerId), {
          reconciliationNote: cleanNote,
          updatedAt: now,
        });
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `restrictedFundsLedger/${ledgerId}`);
      }
    } else {
      setDemoState((prev) => ({
        ...prev,
        restrictedFundsLedger: prev.restrictedFundsLedger.map((r) =>
          r.id === ledgerId ? { ...r, reconciliationNote: cleanNote, updatedAt: now } : r
        ),
        auditLogs: [audit, ...prev.auditLogs],
      }));
    }
    setStatusBanner({
      type: 'success',
      text: 'Restricted ledger reconciliation note recorded (principal untouched).',
    });
  }

  async function approveAndRecordPartnerSettlement(
    settlementId: string,
    approval: PartnerSettlementApprovalInput
  ) {
    if (!isAdmin || !currentUid) throw new Error('Admin privilege required.');
    if (
      !approval.legalApprovalRef.trim() ||
      !approval.partnerBankRef.trim() ||
      !approval.transactionRef.trim()
    ) {
      throw new Error(
        'Legal approval reference, regulated partner bank reference, and transaction reference are all mandatory before settlement.'
      );
    }

    const req = activeState.settlementRequests.find((s) => s.id === settlementId);
    if (!req) throw new Error('Settlement request not found.');
    if (req.status === 'SETTLED_REFUNDED') throw new Error('Already settled.');

    setActionBusy(true);
    const now = new Date().toISOString();
    const txId = makeId('tx');
    const notifId = makeId('ntf');
    const auditId = makeId('aud');

    const refundTx: TransactionRecord = {
      id: txId,
      userId: req.userId,
      challengeId: req.challengeId,
      txType: 'APPROVED_REFUND_SETTLEMENT',
      amountInr: req.amountInr,
      simulated: true,
      referenceId: approval.transactionRef.trim(),
      reconciliationStatus: 'RECONCILED',
      description: `Partner-approved refund settlement (${approval.legalApprovalRef.trim()} / ${approval.partnerBankRef.trim()})`,
      createdAt: now,
    };

    const userNotif: AppNotification = {
      id: notifId,
      userId: req.userId,
      title: 'Restricted Balance Settled',
      message: `Your restricted balance of ₹${req.amountInr.toLocaleString('en-IN')} has been recorded as settled under approval ${approval.legalApprovalRef.trim()} (Ref: ${approval.transactionRef.trim()}).`,
      category: 'SETTLEMENT',
      read: false,
      createdAt: now,
    };

    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: adminRole || 'COMPLIANCE_ADMIN',
      action: 'PARTNER_SETTLEMENT_RECORDED',
      entityType: 'settlementRequests',
      entityId: settlementId,
      summary: `Recorded authorized settlement of ₹${req.amountInr} | Legal: ${approval.legalApprovalRef.trim()} | Partner: ${approval.partnerBankRef.trim()} | Tx: ${approval.transactionRef.trim()}`,
      createdAt: now,
    };

    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        batch.update(doc(db, 'settlementRequests', settlementId), {
          status: 'SETTLED_REFUNDED',
          legalApprovalRef: approval.legalApprovalRef.trim(),
          partnerBankRef: approval.partnerBankRef.trim(),
          transactionRef: approval.transactionRef.trim(),
          approvedBy: currentUser?.email || currentUid,
          settledAt: now,
        });
        batch.update(doc(db, 'restrictedFundsLedger', req.ledgerId), {
          ownershipStatus: 'SETTLED_TO_USER',
          legalPartnerReviewStatus: 'SETTLED',
          reconciliationNote: `Settled via ${approval.legalApprovalRef.trim()} (${approval.transactionRef.trim()})`,
          updatedAt: now,
        });
        batch.set(doc(db, 'transactions', txId), refundTx);
        batch.set(doc(db, 'notifications', notifId), userNotif);
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          settlementRequests: prev.settlementRequests.map((s) =>
            s.id === settlementId
              ? {
                  ...s,
                  status: 'SETTLED_REFUNDED',
                  legalApprovalRef: approval.legalApprovalRef.trim(),
                  partnerBankRef: approval.partnerBankRef.trim(),
                  transactionRef: approval.transactionRef.trim(),
                  approvedBy: currentUser?.email || currentUid,
                  settledAt: now,
                }
              : s
          ),
          restrictedFundsLedger: prev.restrictedFundsLedger.map((r) =>
            r.id === req.ledgerId
              ? {
                  ...r,
                  ownershipStatus: 'SETTLED_TO_USER',
                  legalPartnerReviewStatus: 'SETTLED',
                  reconciliationNote: `Settled via ${approval.legalApprovalRef.trim()} (${approval.transactionRef.trim()})`,
                  updatedAt: now,
                }
              : r
          ),
          transactions: [refundTx, ...prev.transactions],
          notifications: [userNotif, ...prev.notifications],
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }
      setStatusBanner({
        type: 'success',
        text: `Authorized partner settlement recorded (${approval.transactionRef.trim()}) with full audit trail.`,
      });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.UPDATE, `settlementRequests/${settlementId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function toggleUserStatus(targetUid: string, nextStatus: 'ACTIVE' | 'SUSPENDED') {
    if (!isAdmin || !currentUid) throw new Error('Admin privilege required.');
    const now = new Date().toISOString();
    const auditId = makeId('aud');
    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: adminRole || 'COMPLIANCE_ADMIN',
      action: `USER_STATUS_${nextStatus}`,
      entityType: 'users',
      entityId: targetUid,
      summary: `Admin set account ${targetUid} status to ${nextStatus}.`,
      createdAt: now,
    };

    if (authMode === 'firebase') {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', targetUid), {
          accountStatus: nextStatus,
          updatedAt: now,
        });
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
      }
    } else {
      setDemoState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.uid === targetUid ? { ...u, accountStatus: nextStatus, updatedAt: now } : u
        ),
        auditLogs: [audit, ...prev.auditLogs],
      }));
    }
    setStatusBanner({ type: 'info', text: `User account status updated to ${nextStatus}.` });
  }

  async function registerPaymentAccount(
    input: RegisterPaymentAccountInput
  ): Promise<PaymentAccount> {
    if (!currentUid) throw new Error('Sign in required to register a payment account.');

    const holderName = input.holderName.trim().slice(0, 120);
    const accountLabel = input.accountLabel.trim().slice(0, 80);
    if (!holderName || !accountLabel) {
      throw new Error('Account holder name and account label are required.');
    }

    const existingUserAccounts = activeState.paymentAccounts.filter(
      (a) => a.userId === currentUid
    );
    const makePrimary =
      input.setAsPrimary !== undefined ? input.setAsPrimary : existingUserAccounts.length === 0;

    const now = new Date().toISOString();
    const accountId = makeId('pa');
    const auditId = makeId('aud');
    let newAccount: PaymentAccount;

    if (input.accountType === 'UPI_VPA') {
      const upiApp = input.upiApp || 'GPAY';
      const vpa = (input.upiVpa || '').trim();
      if (!isValidUpiVpa(vpa)) {
        throw new Error('Enter a valid UPI ID / VPA (for example, name@okicici or mobile@ybl).');
      }
      newAccount = {
        id: accountId,
        userId: currentUid,
        accountType: 'UPI_VPA',
        holderName,
        accountLabel,
        upiApp,
        upiVpaMasked: maskUpiVpa(vpa),
        isPrimary: makePrimary,
        simulatedMode: true,
        verificationStatus: 'SIMULATED_VERIFIED',
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const bankName = (input.bankName || '').trim().slice(0, 80);
      const ifscCode = normalizeIfscCode(input.ifscCode || '');
      const rawAcct = input.accountNumber || '';
      if (bankName.length < 2) {
        throw new Error('Select or enter a valid Indian bank name.');
      }
      if (!isValidIfscCode(ifscCode)) {
        throw new Error('Enter a valid 11-character Indian IFSC code (e.g. HDFC0000142).');
      }
      if (!isValidBankAccountNumber(rawAcct)) {
        throw new Error('Bank account number must be 9 to 18 numeric digits.');
      }
      const { masked, last4 } = maskBankAccountNumber(rawAcct);
      newAccount = {
        id: accountId,
        userId: currentUid,
        accountType: 'BANK_ACCOUNT',
        holderName,
        accountLabel,
        bankName,
        ifscCode,
        accountNumberMasked: masked,
        accountLast4: last4,
        isPrimary: makePrimary,
        simulatedMode: true,
        verificationStatus: 'SIMULATED_VERIFIED',
        createdAt: now,
        updatedAt: now,
      };
    }

    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: isAdmin ? adminRole || 'COMPLIANCE_ADMIN' : 'USER',
      action: 'PAYMENT_ACCOUNT_REGISTERED',
      entityType: 'paymentAccounts',
      entityId: accountId,
      summary:
        newAccount.accountType === 'UPI_VPA'
          ? `Registered masked UPI account (${getUpiAppOption(newAccount.upiApp).name}: ${newAccount.upiVpaMasked}).`
          : `Registered masked bank account (${newAccount.bankName} ${newAccount.accountNumberMasked}, IFSC ${newAccount.ifscCode}).`,
      createdAt: now,
    };

    setActionBusy(true);
    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        if (makePrimary) {
          existingUserAccounts
            .filter((a) => a.isPrimary)
            .forEach((a) => {
              batch.update(doc(db, 'paymentAccounts', a.id), {
                isPrimary: false,
                updatedAt: now,
              });
            });
        }
        batch.set(doc(db, 'paymentAccounts', accountId), newAccount);
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          paymentAccounts: [
            newAccount,
            ...prev.paymentAccounts.map((a) =>
              a.userId === currentUid && makePrimary ? { ...a, isPrimary: false, updatedAt: now } : a
            ),
          ],
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }

      setStatusBanner({
        type: 'success',
        text: `Payment account "${accountLabel}" registered in simulated mode with privacy masking.`,
      });
      return newAccount;
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.WRITE, `paymentAccounts/${accountId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function setPrimaryPaymentAccount(accountId: string) {
    if (!currentUid) return;
    const target = activeState.paymentAccounts.find(
      (a) => a.id === accountId && a.userId === currentUid
    );
    if (!target) return;

    const now = new Date().toISOString();
    setActionBusy(true);
    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        activeState.paymentAccounts
          .filter((a) => a.userId === currentUid && a.isPrimary && a.id !== accountId)
          .forEach((a) => {
            batch.update(doc(db, 'paymentAccounts', a.id), {
              isPrimary: false,
              updatedAt: now,
            });
          });
        batch.update(doc(db, 'paymentAccounts', accountId), {
          isPrimary: true,
          updatedAt: now,
        });
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          paymentAccounts: prev.paymentAccounts.map((a) =>
            a.userId === currentUid
              ? { ...a, isPrimary: a.id === accountId, updatedAt: now }
              : a
          ),
        }));
      }
      setStatusBanner({
        type: 'success',
        text: `"${target.accountLabel}" set as primary payment & settlement account.`,
      });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.UPDATE, `paymentAccounts/${accountId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  async function removePaymentAccount(accountId: string) {
    if (!currentUid) return;
    const target = activeState.paymentAccounts.find(
      (a) => a.id === accountId && a.userId === currentUid
    );
    if (!target) return;

    const now = new Date().toISOString();
    const auditId = makeId('aud');
    const audit: AuditLogRecord = {
      id: auditId,
      actorUid: currentUid,
      actorRole: isAdmin ? adminRole || 'COMPLIANCE_ADMIN' : 'USER',
      action: 'PAYMENT_ACCOUNT_REMOVED',
      entityType: 'paymentAccounts',
      entityId: accountId,
      summary: `Removed registered payment account "${target.accountLabel}".`,
      createdAt: now,
    };

    setActionBusy(true);
    try {
      if (authMode === 'firebase') {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'paymentAccounts', accountId));
        batch.set(doc(db, 'auditLogs', auditId), audit);
        await batch.commit();
      } else {
        setDemoState((prev) => ({
          ...prev,
          paymentAccounts: prev.paymentAccounts.filter((a) => a.id !== accountId),
          auditLogs: [audit, ...prev.auditLogs],
        }));
      }
      setStatusBanner({
        type: 'info',
        text: `Removed registered payment account "${target.accountLabel}".`,
      });
    } catch (err) {
      if (authMode === 'firebase') {
        handleFirestoreError(err, OperationType.DELETE, `paymentAccounts/${accountId}`);
      }
      throw err;
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <SavingsContext.Provider
      value={{
        authMode,
        authReady,
        firebaseUser,
        currentUid,
        currentUser,
        currentProfile,
        isAdmin,
        adminRole,
        state: activeState,
        actionBusy,
        statusBanner,
        clearBanner,
        signInWithGoogle,
        enterDemoSession,
        registerDemoAccount,
        logout,
        resetDemoWorkspace,
        updateProfile,
        startChallenge,
        recordDailyContribution,
        simulateMissedDeadline,
        markNotificationRead,
        registerPaymentAccount,
        setPrimaryPaymentAccount,
        removePaymentAccount,
        reconcileTransaction,
        addLedgerReconciliationNote,
        approveAndRecordPartnerSettlement,
        toggleUserStatus,
      }}
    >
      {children}
    </SavingsContext.Provider>
  );
}

export function useSavings() {
  const ctx = useContext(SavingsContext);
  if (!ctx) throw new Error('useSavings must be used within SavingsProvider');
  return ctx;
}
