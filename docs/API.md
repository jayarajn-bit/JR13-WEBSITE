# JR13 SAVINGS — REST API Documentation

All monetary values are denominated in **Indian Rupees (INR / ₹)**. All payment flows operate in **Simulated Mode** until Indian legal/regulatory approval and a regulated bank/payment partner are onboarded.

## Authentication & Security
- **Session Cookies**: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **CSRF Protection**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require `X-CSRF-Token` from `GET /api/auth/csrf`.
- **Rate Limiting**: Enabled via `Flask-Limiter` (`120/min` default, `15–20/min` on auth endpoints).

### Endpoints

#### `GET /api/health`
Returns service health and `simulated_payments: true`.

#### `GET /api/auth/csrf`
Issues a session-bound CSRF token.

#### `POST /api/auth/register`
Body: `{ "email", "password" (8+ chars), "full_name", "city", "state" }`
Returns `201 Created` with `{ "user_id", "email", "csrf_token" }`.

#### `POST /api/auth/login`
Body: `{ "email", "password" }`
Returns `200 OK` with `{ "user_id", "email", "csrf_token" }`.

#### `POST /api/auth/google`
Body: `{ "id_token" }` (verified via `google-auth` against `GOOGLE_OAUTH_CLIENT_ID`).

#### `GET /api/challenges/preview`
Query params: `plan_code` (`1D_0PCT` | `49D_2PCT` | `99D_4PCT` | `299D_5PCT` | `364D_8PCT`), `start_amount_inr` (default `10`), `increment_amount_inr` (default `10`), `start_date` (`YYYY-MM-DD`).
Returns full day-by-day INR schedule, `total_planned_inr`, and `proposed_illustrative_bonus_inr`.

#### `POST /api/challenges` (Auth + CSRF)
Body: `{ "plan_code", "start_amount_inr", "increment_amount_inr", "start_date" }`
Creates an `ACTIVE` simulated challenge and initializes streak tracking.

#### `POST /api/payments/upi/intent-preview` (Auth + CSRF)
Body: `{ "upi_app": "GPAY" | "PHONEPE" | "PAYTM" | "BHIM" | "AMAZON_PAY" | "OTHER_UPI", "amount_inr": 10, "upi_vpa": "optional@bank", "note": "optional" }`
Validates the optional VPA (returns masked preview only) and generates a simulated NPCI UPI Intent URI (`jr13.sandbox@simulated.npci`, `sandbox_mode: true`, `live_debit_enabled: false`).

#### `POST /api/challenges/<challenge_id>/contribute` (Auth + CSRF)
Optional Body: `{ "upi_app": "GPAY" | "PHONEPE" | "PAYTM" | "BHIM" | "AMAZON_PAY" | "OTHER_UPI", "upi_vpa": "optional@bank" }`
Enforces strictly 1 daily streak deposit per 24 hours (returns `429 Too Many Requests` with `next_unlock_at` and `retry_after_seconds` until 24 hours have elapsed since the user's previous contribution). Records the next scheduled simulated daily deposit (storing masked VPA only), updates streak, returns `next_streak_unlock_at`, and if the final day is reached, marks challenge `COMPLETED`, locks it, and records the illustrative one-time completion bonus (`eligible_savings * rate / 100`) when `bonus_rate > 0`. Returns `409 Conflict` if locked or failed.

#### `POST /api/challenges/<challenge_id>/fail-missed-deadline` (Auth + CSRF)
Optional Body: `{ "cause": "24-Hour Streak Window Expired", "description": "optional details" }`
Marks challenge `FAILED`, sets `locked = true`, breaks streak, records the failure cause & challenge description, and preserves 100% of `total_saved_inr` in `restricted_funds_ledger` (`forfeiture_prohibited = true`, `admin_spend_prohibited = true`) plus a `settlement_requests` entry (`PENDING_LEGAL_PARTNER_REVIEW`).

#### `POST /api/admin/restricted-ledger/<ledger_id>/spend` (Admin + CSRF)
Always returns `403 Forbidden`. Customer restricted balances cannot be spent, withdrawn, reallocated, or forfeited by admins.

#### `PATCH /api/admin/restricted-ledger/<ledger_id>/reconcile` (Admin + CSRF)
Body: `{ "reconciliation_note" }`
Allows Compliance Admins / Reconciliation Officers to record reconciliation notes and audit logs without altering customer principal.

#### `POST /api/admin/settlements/<settlement_id>/record-partner-settlement` (Admin + CSRF)
Body: `{ "legal_approval_ref", "partner_bank_ref", "transaction_ref" }`
Records partner-approved refund settlement (`SETTLED_REFUNDED`), updates ledger ownership status to `SETTLED_TO_USER`, inserts `APPROVED_REFUND_SETTLEMENT` transaction, user notification, and immutable `audit_logs` record.

#### `GET /api/admin/missed-challenges-summary` (Admin)
Query param: `partner_spread_pct` (optional `0`–`25`, default `1.5`).
Returns Admin-only totals of failed/missed-deadline challenges (including each challenge's `description` and failure `cause`), broken streaks, preserved customer principal (`forfeited_profit_from_missed_inr: 0.0`), uncollected planned gap, and simulated illustrative platform spread vs bonus outflow (`403 Forbidden` for non-admin users).

#### `GET /api/payment-accounts` (Auth)
Returns the signed-in user's registered payment accounts with privacy-masked UPI VPAs and masked bank account numbers (`account_number_masked`, `account_last4`, `ifsc_code`).

#### `POST /api/payment-accounts` (Auth + CSRF)
Body (`UPI_VPA`): `{ "account_type": "UPI_VPA", "holder_name", "account_label", "upi_app", "upi_vpa", "is_primary" }`
Body (`BANK_ACCOUNT`): `{ "account_type": "BANK_ACCOUNT", "holder_name", "account_label", "bank_name", "ifsc_code", "account_number", "is_primary" }`
Validates NPCI VPA format, 11-character Indian IFSC (`^[A-Z]{4}0[A-Z0-9]{6}$`), and 9–18 digit account numbers; masks sensitive identifiers prior to storage and records an `audit_logs` event.

#### `PATCH /api/payment-accounts/<account_id>/primary` & `DELETE /api/payment-accounts/<account_id>` (Auth + CSRF)
Sets the owner's primary payment/settlement account or deletes a registered payment account with audit logging.
