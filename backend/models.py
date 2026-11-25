from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint

db = SQLAlchemy()


def utc_now():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(64), primary_key=True)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=True)
    google_sub = db.Column(db.String(128), unique=True, nullable=True)
    auth_provider = db.Column(db.String(20), nullable=False, default="demo")
    account_status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class Profile(db.Model):
    __tablename__ = "profiles"

    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    phone_masked = db.Column(db.String(20), nullable=True)
    city = db.Column(db.String(80), nullable=True)
    state = db.Column(db.String(80), nullable=True)
    preferred_start_inr = db.Column(db.Numeric(12, 2), nullable=False, default=10)
    preferred_increment_inr = db.Column(db.Numeric(12, 2), nullable=False, default=10)
    preferred_upi_app = db.Column(db.String(24), nullable=True)
    preferred_upi_vpa_masked = db.Column(db.String(80), nullable=True)
    kyc_simulation_status = db.Column(db.String(32), nullable=False, default="SIMULATED_VERIFIED")
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class Challenge(db.Model):
    __tablename__ = "challenges"
    __table_args__ = (
        CheckConstraint("duration_days IN (1, 49, 99, 299, 364)", name="ck_challenge_duration"),
        CheckConstraint("total_saved_inr >= 0", name="ck_challenge_saved_nonneg"),
    )

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_code = db.Column(db.String(24), nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)
    illustrative_bonus_rate = db.Column(db.Numeric(5, 2), nullable=False)
    start_amount_inr = db.Column(db.Numeric(12, 2), nullable=False, default=10)
    increment_amount_inr = db.Column(db.Numeric(12, 2), nullable=False, default=10)
    total_planned_inr = db.Column(db.Numeric(14, 2), nullable=False)
    total_saved_inr = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    completed_days = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="ACTIVE")
    locked = db.Column(db.Boolean, nullable=False, default=False)
    simulated_mode = db.Column(db.Boolean, nullable=False, default=True)
    start_date = db.Column(db.Date, nullable=False)
    next_due_date = db.Column(db.Date, nullable=False)
    failed_reason = db.Column(db.String(240), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class DailyContribution(db.Model):
    __tablename__ = "daily_contributions"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    day_number = db.Column(db.Integer, nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    amount_inr = db.Column(db.Numeric(12, 2), nullable=False)
    status = db.Column(db.String(24), nullable=False, default="PAID_SIMULATED")
    reference_code = db.Column(db.String(64), unique=True, nullable=False)
    upi_app = db.Column(db.String(24), nullable=True)
    upi_vpa_masked = db.Column(db.String(80), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class Streak(db.Model):
    __tablename__ = "streaks"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_streak = db.Column(db.Integer, nullable=False, default=0)
    longest_streak = db.Column(db.Integer, nullable=False, default=0)
    last_contribution_date = db.Column(db.Date, nullable=True)
    streak_broken = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    tx_type = db.Column(db.String(40), nullable=False)
    amount_inr = db.Column(db.Numeric(14, 2), nullable=False)
    simulated = db.Column(db.Boolean, nullable=False, default=True)
    reference_id = db.Column(db.String(64), unique=True, nullable=False)
    reconciliation_status = db.Column(db.String(24), nullable=False, default="RECONCILED")
    upi_app = db.Column(db.String(24), nullable=True)
    upi_vpa_masked = db.Column(db.String(80), nullable=True)
    description = db.Column(db.String(240), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class RestrictedFundsLedger(db.Model):
    __tablename__ = "restricted_funds_ledger"
    __table_args__ = (
        CheckConstraint("forfeiture_prohibited = TRUE", name="ck_no_forfeiture"),
        CheckConstraint("admin_spend_prohibited = TRUE", name="ck_no_admin_spend"),
        CheckConstraint("principal_balance_inr >= 0", name="ck_restricted_nonneg"),
    )

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), unique=True, nullable=False)
    principal_balance_inr = db.Column(db.Numeric(14, 2), nullable=False)
    ownership_status = db.Column(db.String(32), nullable=False, default="USER_OWNED_RESTRICTED")
    forfeiture_prohibited = db.Column(db.Boolean, nullable=False, default=True)
    admin_spend_prohibited = db.Column(db.Boolean, nullable=False, default=True)
    legal_partner_review_status = db.Column(db.String(40), nullable=False, default="PENDING_LEGAL_PARTNER_REVIEW")
    reconciliation_note = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class SettlementRequest(db.Model):
    __tablename__ = "settlement_requests"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    ledger_id = db.Column(db.String(64), db.ForeignKey("restricted_funds_ledger.id", ondelete="CASCADE"), nullable=False)
    amount_inr = db.Column(db.Numeric(14, 2), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="PENDING_LEGAL_PARTNER_REVIEW")
    legal_approval_ref = db.Column(db.String(100), nullable=True)
    partner_bank_ref = db.Column(db.String(100), nullable=True)
    transaction_ref = db.Column(db.String(100), nullable=True)
    approved_by = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    settled_at = db.Column(db.DateTime(timezone=True), nullable=True)


class RewardRecord(db.Model):
    __tablename__ = "reward_records"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    challenge_id = db.Column(db.String(64), db.ForeignKey("challenges.id", ondelete="CASCADE"), unique=True, nullable=False)
    eligible_savings_inr = db.Column(db.Numeric(14, 2), nullable=False)
    bonus_rate_pct = db.Column(db.Numeric(5, 2), nullable=False)
    bonus_amount_inr = db.Column(db.Numeric(14, 2), nullable=False)
    illustrative_only = db.Column(db.Boolean, nullable=False, default=True)
    status = db.Column(db.String(32), nullable=False, default="CREDITED_SIMULATED")
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(140), nullable=False)
    message = db.Column(db.String(400), nullable=False)
    category = db.Column(db.String(32), nullable=False)
    read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class AdminUser(db.Model):
    __tablename__ = "admin_users"

    uid = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email = db.Column(db.String(254), unique=True, nullable=False)
    role = db.Column(db.String(32), nullable=False, default="COMPLIANCE_ADMIN")
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(64), primary_key=True)
    actor_uid = db.Column(db.String(64), nullable=False, index=True)
    actor_role = db.Column(db.String(32), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(60), nullable=False)
    entity_id = db.Column(db.String(128), nullable=False)
    summary = db.Column(db.String(320), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)


class PaymentAccount(db.Model):
    __tablename__ = "payment_accounts"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_type = db.Column(db.String(20), nullable=False)
    holder_name = db.Column(db.String(120), nullable=False)
    account_label = db.Column(db.String(80), nullable=False)
    upi_app = db.Column(db.String(24), nullable=True)
    upi_vpa_masked = db.Column(db.String(80), nullable=True)
    bank_name = db.Column(db.String(80), nullable=True)
    ifsc_code = db.Column(db.String(11), nullable=True)
    account_number_masked = db.Column(db.String(32), nullable=True)
    account_last4 = db.Column(db.String(4), nullable=True)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)
    simulated_mode = db.Column(db.Boolean, nullable=False, default=True)
    verification_status = db.Column(db.String(36), nullable=False, default="SIMULATED_VERIFIED")
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
