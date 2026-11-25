import QRCode from 'qrcode';
import type { UpiAppId } from '../types/savings';

export interface UpiAppOption {
  id: UpiAppId;
  name: string;
  shortCode: string;
  sampleHandle: string;
  schemePrefix: string;
}

export const UPI_APPS: UpiAppOption[] = [
  {
    id: 'GPAY',
    name: 'Google Pay',
    shortCode: 'GPay',
    sampleHandle: 'name@okicici',
    schemePrefix: 'tez://upi/pay',
  },
  {
    id: 'PHONEPE',
    name: 'PhonePe',
    shortCode: 'PhonePe',
    sampleHandle: 'number@ybl',
    schemePrefix: 'phonepe://pay',
  },
  {
    id: 'PAYTM',
    name: 'Paytm UPI',
    shortCode: 'Paytm',
    sampleHandle: 'number@paytm',
    schemePrefix: 'paytmmp://pay',
  },
  {
    id: 'BHIM',
    name: 'BHIM UPI',
    shortCode: 'BHIM',
    sampleHandle: 'name@upi',
    schemePrefix: 'upi://pay',
  },
  {
    id: 'AMAZON_PAY',
    name: 'Amazon Pay UPI',
    shortCode: 'APay',
    sampleHandle: 'number@apl',
    schemePrefix: 'upi://pay',
  },
  {
    id: 'OTHER_UPI',
    name: 'Any UPI App / VPA',
    shortCode: 'UPI ID',
    sampleHandle: 'user@bankhandle',
    schemePrefix: 'upi://pay',
  },
];

export function getUpiAppOption(id?: UpiAppId): UpiAppOption {
  return UPI_APPS.find((a) => a.id === id) || UPI_APPS[0];
}

const VPA_REGEX = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,32}$/;

export function isValidUpiVpa(vpa: string): boolean {
  return VPA_REGEX.test(vpa.trim());
}

export function maskUpiVpa(vpa: string): string {
  const clean = vpa.trim().toLowerCase();
  const [local, handle] = clean.split('@');
  if (!local || !handle) return '••••@upi';
  if (local.length <= 2) return `${local[0] || '•'}••@${handle}`;
  return `${local.slice(0, 2)}••••${local.slice(-2)}@${handle}`;
}

export function buildSimulatedUpiIntentUri(params: {
  amountInr: number;
  transactionRef: string;
  note: string;
  appId?: UpiAppId;
}): string {
  const query = new URLSearchParams({
    pa: 'jr13.sandbox@simulated.npci',
    pn: 'JR13 SAVINGS (SIMULATED)',
    tr: params.transactionRef,
    tn: params.note.slice(0, 60),
    am: params.amountInr.toFixed(2),
    cu: 'INR',
    mode: '02',
  });
  const app = getUpiAppOption(params.appId);
  return `${app.schemePrefix}?${query.toString()}`;
}

export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    width: 220,
    margin: 2,
    color: {
      dark: '#060B16',
      light: '#F8FAFC',
    },
  });
}

export const UPI_REGULATORY_GATE_NOTICE =
  'Simulated UPI Mode Active: PhonePe, Google Pay, Paytm, BHIM, and standard NPCI UPI Intent flows are simulated here. No real money is debited or collected. Integrating a Payment Aggregator or UPI Intent gateway alone does not authorize deposit-taking or guaranteed interest; live collection remains locked until Indian legal review and an authorized regulated bank/payment partner approve the complete flow.';

export const INDIAN_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India (SBI)',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Yes Bank',
  'IndusInd Bank',
  'Federal Bank',
  'Punjab National Bank',
  'Bank of Baroda',
] as const;

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT_REGEX = /^[0-9]{9,18}$/;

export function normalizeIfscCode(ifsc: string): string {
  return ifsc.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidIfscCode(ifsc: string): boolean {
  return IFSC_REGEX.test(normalizeIfscCode(ifsc));
}

export function normalizeBankAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/[\s-]+/g, '').trim();
}

export function isValidBankAccountNumber(accountNumber: string): boolean {
  return BANK_ACCOUNT_REGEX.test(normalizeBankAccountNumber(accountNumber));
}

export function maskBankAccountNumber(accountNumber: string): {
  masked: string;
  last4: string;
} {
  const digits = normalizeBankAccountNumber(accountNumber);
  const last4 = digits.slice(-4);
  const hiddenLen = Math.max(4, digits.length - 4);
  return {
    masked: `${'•'.repeat(Math.min(hiddenLen, 10))}${last4}`,
    last4,
  };
}

