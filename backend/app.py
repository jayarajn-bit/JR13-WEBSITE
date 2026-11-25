from datetime import date, timedelta, timezone
from decimal import Decimal
import os
import re
from urllib.parse import urlencode
from flask import Flask, g, jsonify, request, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from config import Config
from models import (
    AdminUser,
    AuditLog,
    Challenge,
    DailyContribution,
    Notification,
    PaymentAccount,
    Profile,
    RestrictedFundsLedger,
    RewardRecord,
    SettlementRequest,
    Streak,
    Transaction,
    User,
    db,
    utc_now,
)
from security import (
    ensure_csrf_token,
    hash_password,
    require_admin,
    require_auth,
    require_csrf,
    verify_password,
)
from services.challenge_engine import (
    PLAN_CATALOG,
    build_schedule_preview,
    day_amount_inr,
    gen_id,
    illustrative_bonus_inr,
    total_planned_inr,
)


UPI_APP_SCHEMES = {
    "GPAY": ("Google Pay", "tez://upi/pay"),
    "PHONEPE": ("PhonePe", "phonepe://pay"),
    "PAYTM": ("Paytm UPI", "paytmmp://pay"),
    "BHIM": ("BHIM UPI", "upi://pay"),
    "AMAZON_PAY": ("Amazon Pay UPI", "upi://pay"),
    "OTHER_UPI": ("Any UPI App / VPA", "upi://pay"),
}
UPI_VPA_RE = re.compile(r"^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,32}$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
BANK_ACCOUNT_RE = re.compile(r"^[0-9]{9,18}$")


def mask_upi_vpa(vpa: str) -> str:
    clean = vpa.strip().lower()
    if "@" not in clean:
        return "••••@upi"
    local, handle = clean.split("@", 1)
    if len(local) <= 2:
        return f"{local[:1] or '•'}••@{handle}"
    return f"{local[:2]}••••{local[-2:]}@{handle}"


def mask_bank_account(account_number: str) -> tuple[str, str]:
    digits = re.sub(r"[\s-]+", "", account_number or "")
    last4 = digits[-4:]
    dots = "•" * min(10, max(4, len(digits) - 4))
    return f"{dots}{last4}", last4


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    CORS(
        app,
        supports_credentials=True,
        origins=app.config["CORS_ALLOWED_ORIGINS"],
    )
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["120 per minute"],
        storage_uri="memory://",
    )

    @app.after_request
    def apply_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "jr13-savings-api", "simulated_payments": True})

    @app.get("/api/auth/csrf")
    def get_csrf():
        return jsonify({"csrf_token": ensure_csrf_token()})

    @app.post("/api/auth/register")
    @limiter.limit("15 per minute")
    def register():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        full_name = (data.get("full_name") or "").strip()
        if not email or "@" not in email or len(password) < 8 or not full_name:
            return jsonify({"error": "Valid email, full_name, and 8+ char password required"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        uid = gen_id("usr")
        user = User(
            id=uid,
            email=email,
            password_hash=hash_password(password),
            auth_provider="local",
            account_status="ACTIVE",
        )
        profile = Profile(
            user_id=uid,
            full_name=full_name,
            city=(data.get("city") or "").strip(),
            state=(data.get("state") or "").strip(),
        )
        db.session.add(user)
        db.session.add(profile)
        db.session.commit()

        session["user_id"] = uid
        csrf_token = ensure_csrf_token()
        return jsonify({"user_id": uid, "email": email, "csrf_token": csrf_token}), 201

    @app.post("/api/auth/login")
    @limiter.limit("20 per minute")
    def login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        user = User.query.filter_by(email=email).first()
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            return jsonify({"error": "Invalid credentials"}), 401
        if user.account_status != "ACTIVE":
            return jsonify({"error": "Account suspended"}), 403

        session["user_id"] = user.id
        csrf_token = ensure_csrf_token()
        return jsonify({"user_id": user.id, "email": user.email, "csrf_token": csrf_token})

    @app.post("/api/auth/google")
    @limiter.limit("20 per minute")
    def google_oauth_login():
        data = request.get_json(silent=True) or {}
        credential = data.get("id_token") or ""
        client_id = app.config.get("GOOGLE_CLIENT_ID")
        if not client_id:
            return jsonify({"error": "Google OAuth client ID not configured; use Demo Mode"}), 503

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), client_id
            )
        except Exception:
            return jsonify({"error": "Invalid Google ID token"}), 401

        email = (idinfo.get("email") or "").lower()
        sub = idinfo.get("sub")
        user = User.query.filter((User.google_sub == sub) | (User.email == email)).first()
        if not user:
            uid = gen_id("usr")
            user = User(id=uid, email=email, google_sub=sub, auth_provider="google")
            profile = Profile(user_id=uid, full_name=idinfo.get("name") or email.split("@")[0])
            db.session.add(user)
            db.session.add(profile)
            db.session.commit()

        session["user_id"] = user.id
        csrf_token = ensure_csrf_token()
        return jsonify({"user_id": user.id, "email": user.email, "csrf_token": csrf_token})

    @app.post("/api/auth/logout")
    @require_csrf
    def logout():
        session.clear()
        return jsonify({"status": "logged_out"})

    @app.get("/api/challenges/preview")
    def preview_schedule():
        plan_code = request.args.get("plan_code", "99D_4PCT")
        if plan_code not in PLAN_CATALOG:
            return jsonify({"error": "Invalid plan_code"}), 400
        try:
            start_amt = Decimal(request.args.get("start_amount_inr", "10"))
            inc_amt = Decimal(request.args.get("increment_amount_inr", "10"))
            start_dt = date.fromisoformat(request.args.get("start_date", date.today().isoformat()))
        except Exception:
            return jsonify({"error": "Invalid numeric or date parameters"}), 400

        if start_amt < Decimal("10") or inc_amt < Decimal("5"):
            return jsonify({"error": "Minimum Day 1 amount is ₹10 and increment is ₹5"}), 400

        plan = PLAN_CATALOG[plan_code]
        planned = total_planned_inr(plan["duration_days"], start_amt, inc_amt)
        bonus = illustrative_bonus_inr(planned, plan["bonus_rate"])
        schedule = build_schedule_preview(plan["duration_days"], start_amt, inc_amt, start_dt)
        return jsonify(
            {
                "plan_code": plan_code,
                "duration_days": plan["duration_days"],
                "illustrative_bonus_rate": float(plan["bonus_rate"]),
                "total_planned_inr": float(planned),
                "proposed_illustrative_bonus_inr": float(bonus),
                "disclosure": "Proposed illustrative rates only; not guaranteed returns.",
                "schedule": schedule,
            }
        )

    @app.post("/api/challenges")
    @require_auth
    @require_csrf
    def enroll_challenge():
        data = request.get_json(silent=True) or {}
        plan_code = data.get("plan_code", "")
        if plan_code not in PLAN_CATALOG:
            return jsonify({"error": "Unsupported challenge plan"}), 400
        try:
            start_amt = Decimal(str(data.get("start_amount_inr", "10")))
            inc_amt = Decimal(str(data.get("increment_amount_inr", "10")))
            start_dt = date.fromisoformat(data.get("start_date", date.today().isoformat()))
        except Exception:
            return jsonify({"error": "Invalid schedule configuration"}), 400

        if start_amt < Decimal("10") or inc_amt < Decimal("5"):
            return jsonify({"error": "Minimum start_amount_inr is 10 and increment is 5"}), 400

        plan = PLAN_CATALOG[plan_code]
        planned = total_planned_inr(plan["duration_days"], start_amt, inc_amt)
        chl_id = gen_id("chl")
        challenge = Challenge(
            id=chl_id,
            user_id=g.current_user.id,
            plan_code=plan_code,
            duration_days=plan["duration_days"],
            illustrative_bonus_rate=plan["bonus_rate"],
            start_amount_inr=start_amt,
            increment_amount_inr=inc_amt,
            total_planned_inr=planned,
            start_date=start_dt,
            next_due_date=start_dt,
            simulated_mode=True,
        )
        streak = Streak(
            id=gen_id("str"),
            user_id=g.current_user.id,
            challenge_id=chl_id,
        )
        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role="USER",
            action="CHALLENGE_ENROLLED",
            entity_type="challenges",
            entity_id=chl_id,
            summary=f"Enrolled in {plan_code} simulated schedule totaling ₹{planned}.",
        )
        db.session.add_all([challenge, streak, audit])
        db.session.commit()
        return jsonify({"id": chl_id, "status": "ACTIVE", "total_planned_inr": float(planned)}), 201

    @app.post("/api/payments/upi/intent-preview")
    @require_auth
    @require_csrf
    def preview_upi_intent():
        data = request.get_json(silent=True) or {}
        upi_app = (data.get("upi_app") or "GPAY").strip().upper()
        if upi_app not in UPI_APP_SCHEMES:
            return jsonify({"error": "Unsupported UPI app identifier"}), 400
        try:
            amount_inr = Decimal(str(data.get("amount_inr", "0")))
        except Exception:
            return jsonify({"error": "Invalid amount_inr"}), 400
        if amount_inr <= Decimal("0"):
            return jsonify({"error": "amount_inr must be greater than zero"}), 400

        upi_vpa = (data.get("upi_vpa") or "").strip()
        if upi_vpa and not UPI_VPA_RE.match(upi_vpa):
            return jsonify({"error": "Invalid UPI VPA format"}), 400

        app_name, scheme_prefix = UPI_APP_SCHEMES[upi_app]
        tx_ref = gen_id("SIMUPI").upper()
        note = (data.get("note") or "JR13 SAVINGS Simulated Contribution").strip()[:60]
        params = urlencode(
            {
                "pa": "jr13.sandbox@simulated.npci",
                "pn": "JR13 SAVINGS (SIMULATED)",
                "tr": tx_ref,
                "tn": note,
                "am": f"{amount_inr:.2f}",
                "cu": "INR",
                "mode": "02",
            }
        )
        return jsonify(
            {
                "upi_app": upi_app,
                "upi_app_name": app_name,
                "upi_vpa_masked": mask_upi_vpa(upi_vpa) if upi_vpa else None,
                "transaction_ref": tx_ref,
                "upi_intent_uri": f"{scheme_prefix}?{params}",
                "sandbox_mode": True,
                "live_debit_enabled": False,
                "regulatory_notice": (
                    "Simulated UPI sandbox only. Live collection remains locked until Indian legal review "
                    "and an authorized regulated bank/payment partner approve the flow."
                ),
            }
        )

    @app.post("/api/challenges/<challenge_id>/contribute")
    @require_auth
    @require_csrf
    def record_contribution(challenge_id):
        challenge = Challenge.query.filter_by(id=challenge_id, user_id=g.current_user.id).first()
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        if challenge.locked or challenge.status != "ACTIVE":
            return jsonify({"error": "Challenge is locked; further contributions are prohibited"}), 409

        latest_contrib = (
            DailyContribution.query.filter_by(user_id=g.current_user.id, status="PAID_SIMULATED")
            .order_by(DailyContribution.created_at.desc())
            .first()
        )
        now_utc = utc_now()
        if latest_contrib and latest_contrib.created_at:
            last_dt = latest_contrib.created_at
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            unlock_at = last_dt + timedelta(hours=24)
            if now_utc < unlock_at:
                retry_seconds = max(1, int((unlock_at - now_utc).total_seconds()))
                return jsonify(
                    {
                        "error": (
                            "Only 1 daily streak contribution is allowed every 24 hours. "
                            "Next streak starts after 24 hours."
                        ),
                        "last_contribution_at": last_dt.isoformat(),
                        "next_unlock_at": unlock_at.isoformat(),
                        "retry_after_seconds": retry_seconds,
                    }
                ), 429

        data = request.get_json(silent=True) or {}
        upi_app = data.get("upi_app")
        upi_vpa = (data.get("upi_vpa") or "").strip()
        upi_app_clean = None
        upi_vpa_masked = None
        if upi_app:
            upi_app_clean = str(upi_app).strip().upper()
            if upi_app_clean not in UPI_APP_SCHEMES:
                return jsonify({"error": "Unsupported UPI app identifier"}), 400
        if upi_vpa:
            if not UPI_VPA_RE.match(upi_vpa):
                return jsonify({"error": "Invalid UPI VPA format"}), 400
            upi_vpa_masked = mask_upi_vpa(upi_vpa)

        next_day = challenge.completed_days + 1
        amt = day_amount_inr(next_day, challenge.start_amount_inr, challenge.increment_amount_inr)
        sched_date = challenge.start_date + timedelta(days=next_day - 1)
        ref_code = gen_id("SIMUPI" if upi_app_clean else "SIMDEP").upper()
        channel_name = UPI_APP_SCHEMES[upi_app_clean][0] if upi_app_clean else None

        contrib = DailyContribution(
            id=gen_id("dc"),
            user_id=g.current_user.id,
            challenge_id=challenge.id,
            day_number=next_day,
            scheduled_date=sched_date,
            amount_inr=amt,
            status="PAID_SIMULATED",
            reference_code=ref_code,
            upi_app=upi_app_clean,
            upi_vpa_masked=upi_vpa_masked,
        )
        tx = Transaction(
            id=gen_id("tx"),
            user_id=g.current_user.id,
            challenge_id=challenge.id,
            tx_type="SIMULATED_DEPOSIT",
            amount_inr=amt,
            simulated=True,
            reference_id=ref_code,
            reconciliation_status="RECONCILED",
            upi_app=upi_app_clean,
            upi_vpa_masked=upi_vpa_masked,
            description=(
                f"Day {next_day} simulated {channel_name} UPI deposit"
                if channel_name
                else f"Day {next_day} simulated deposit"
            ),
        )
        challenge.completed_days = next_day
        challenge.total_saved_inr = Decimal(challenge.total_saved_inr) + amt

        streak = Streak.query.filter_by(challenge_id=challenge.id).first()
        if streak:
            streak.current_streak += 1
            streak.longest_streak = max(streak.longest_streak, streak.current_streak)
            streak.last_contribution_date = sched_date
            streak.streak_broken = False

        reward_payload = None
        if next_day >= challenge.duration_days:
            challenge.status = "COMPLETED"
            challenge.locked = True
            challenge.next_due_date = sched_date
            if Decimal(challenge.illustrative_bonus_rate) > Decimal("0"):
                bonus = illustrative_bonus_inr(
                    Decimal(challenge.total_saved_inr), Decimal(challenge.illustrative_bonus_rate)
                )
                reward = RewardRecord(
                    id=gen_id("rwd"),
                    user_id=g.current_user.id,
                    challenge_id=challenge.id,
                    eligible_savings_inr=challenge.total_saved_inr,
                    bonus_rate_pct=challenge.illustrative_bonus_rate,
                    bonus_amount_inr=bonus,
                    illustrative_only=True,
                    status="CREDITED_SIMULATED",
                )
                bonus_tx = Transaction(
                    id=gen_id("tx"),
                    user_id=g.current_user.id,
                    challenge_id=challenge.id,
                    tx_type="ILLUSTRATIVE_BONUS_CREDIT",
                    amount_inr=bonus,
                    simulated=True,
                    reference_id=gen_id("BONILL").upper(),
                    reconciliation_status="RECONCILED",
                    description="Proposed illustrative one-time completion bonus (simulated)",
                )
                db.session.add_all([reward, bonus_tx])
                reward_payload = {"bonus_amount_inr": float(bonus), "illustrative_only": True}
        else:
            challenge.next_due_date = challenge.start_date + timedelta(days=next_day)

        db.session.add_all([contrib, tx])
        db.session.commit()
        return jsonify(
            {
                "challenge_id": challenge.id,
                "day_number": next_day,
                "amount_inr": float(amt),
                "status": challenge.status,
                "locked": challenge.locked,
                "current_streak": streak.current_streak if streak else next_day,
                "upi_app": upi_app_clean,
                "upi_vpa_masked": upi_vpa_masked,
                "next_streak_unlock_at": (now_utc + timedelta(hours=24)).isoformat(),
                "reward": reward_payload,
            }
        )

    @app.post("/api/challenges/<challenge_id>/fail-missed-deadline")
    @require_auth
    @require_csrf
    def fail_missed_deadline(challenge_id):
        challenge = Challenge.query.filter_by(id=challenge_id, user_id=g.current_user.id).first()
        if not challenge:
            return jsonify({"error": "Challenge not found"}), 404
        if challenge.status != "ACTIVE":
            return jsonify({"error": "Challenge is not active"}), 409

        data = request.get_json(silent=True) or {}
        raw_cause = (data.get("cause") or "").strip()
        raw_desc = (data.get("description") or "").strip()
        if raw_cause and raw_desc:
            failed_reason = f"{raw_cause}: {raw_desc}"[:240]
        elif raw_cause or raw_desc:
            failed_reason = (raw_cause or raw_desc)[:240]
        else:
            failed_reason = (
                "Deadline missed. Challenge locked; principal preserved in Restricted Funds Ledger."
            )

        challenge.status = "FAILED"
        challenge.locked = True
        challenge.failed_reason = failed_reason

        streak = Streak.query.filter_by(challenge_id=challenge.id).first()
        if streak:
            streak.current_streak = 0
            streak.streak_broken = True

        ledger_id = None
        settlement_id = None
        if Decimal(challenge.total_saved_inr) > Decimal("0"):
            ledger = RestrictedFundsLedger(
                id=gen_id("rfl"),
                user_id=challenge.user_id,
                challenge_id=challenge.id,
                principal_balance_inr=challenge.total_saved_inr,
                ownership_status="USER_OWNED_RESTRICTED",
                forfeiture_prohibited=True,
                admin_spend_prohibited=True,
                legal_partner_review_status="PENDING_LEGAL_PARTNER_REVIEW",
                reconciliation_note=f"Cause: {failed_reason}"[:300],
            )
            settlement = SettlementRequest(
                id=gen_id("stl"),
                user_id=challenge.user_id,
                challenge_id=challenge.id,
                ledger_id=ledger.id,
                amount_inr=challenge.total_saved_inr,
                status="PENDING_LEGAL_PARTNER_REVIEW",
            )
            hold_tx = Transaction(
                id=gen_id("tx"),
                user_id=challenge.user_id,
                challenge_id=challenge.id,
                tx_type="RESTRICTED_HOLD_TRANSFER",
                amount_inr=challenge.total_saved_inr,
                simulated=True,
                reference_id=gen_id("RSTHOLD").upper(),
                reconciliation_status="RECONCILED",
                description=f"Restricted hold ({failed_reason})"[:240],
            )
            db.session.add_all([ledger, settlement, hold_tx])
            ledger_id = ledger.id
            settlement_id = settlement.id

        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role="USER",
            action="CHALLENGE_FAILED_RESTRICTED_PRESERVED",
            entity_type="challenges",
            entity_id=challenge.id,
            summary=f"Challenge locked ({failed_reason}); ₹{challenge.total_saved_inr} preserved."[:320],
        )
        db.session.add(audit)
        db.session.commit()
        return jsonify(
            {
                "challenge_id": challenge.id,
                "status": "FAILED",
                "locked": True,
                "cause": failed_reason,
                "description": (
                    f"{challenge.plan_code} · Day {challenge.completed_days}/{challenge.duration_days} "
                    f"· Start ₹{challenge.start_amount_inr} (+₹{challenge.increment_amount_inr}/day)"
                ),
                "restricted_ledger_id": ledger_id,
                "settlement_request_id": settlement_id,
            }
        )

    @app.post("/api/admin/restricted-ledger/<ledger_id>/spend")
    @require_admin()
    @require_csrf
    def prohibit_admin_spend(ledger_id):
        # Explicitly enforces non-forfeiture & admin-spend prohibition
        return jsonify(
            {
                "error": (
                    "Prohibited operation: Admin spending, withdrawal, reallocation, or "
                    "forfeiture of customer restricted funds is strictly forbidden."
                )
            }
        ), 403

    @app.patch("/api/admin/restricted-ledger/<ledger_id>/reconcile")
    @require_admin()
    @require_csrf
    def reconcile_restricted_ledger(ledger_id):
        ledger = RestrictedFundsLedger.query.get(ledger_id)
        if not ledger:
            return jsonify({"error": "Restricted ledger entry not found"}), 404
        data = request.get_json(silent=True) or {}
        note = (data.get("reconciliation_note") or "").strip()[:300]
        if not note:
            return jsonify({"error": "reconciliation_note is required"}), 400

        ledger.reconciliation_note = note
        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role=g.admin_role,
            action="RESTRICTED_LEDGER_RECONCILED",
            entity_type="restricted_funds_ledger",
            entity_id=ledger_id,
            summary=f"Admin added reconciliation note: {note[:120]}",
        )
        db.session.add(audit)
        db.session.commit()
        return jsonify({"id": ledger.id, "reconciliation_note": ledger.reconciliation_note})

    @app.post("/api/admin/settlements/<settlement_id>/record-partner-settlement")
    @require_admin()
    @require_csrf
    def record_partner_settlement(settlement_id):
        req = SettlementRequest.query.get(settlement_id)
        if not req:
            return jsonify({"error": "Settlement request not found"}), 404
        if req.status == "SETTLED_REFUNDED":
            return jsonify({"error": "Settlement already finalized"}), 409

        data = request.get_json(silent=True) or {}
        legal_ref = (data.get("legal_approval_ref") or "").strip()
        partner_ref = (data.get("partner_bank_ref") or "").strip()
        tx_ref = (data.get("transaction_ref") or "").strip()
        if not legal_ref or not partner_ref or not tx_ref:
            return jsonify(
                {
                    "error": (
                        "legal_approval_ref, partner_bank_ref, and transaction_ref are all "
                        "required after authorized legal/regulated-partner approval."
                    )
                }
            ), 400

        now = utc_now()
        req.status = "SETTLED_REFUNDED"
        req.legal_approval_ref = legal_ref
        req.partner_bank_ref = partner_ref
        req.transaction_ref = tx_ref
        req.approved_by = g.current_user.email
        req.settled_at = now

        ledger = RestrictedFundsLedger.query.get(req.ledger_id)
        if ledger:
            ledger.ownership_status = "SETTLED_TO_USER"
            ledger.legal_partner_review_status = "SETTLED"

        refund_tx = Transaction(
            id=gen_id("tx"),
            user_id=req.user_id,
            challenge_id=req.challenge_id,
            tx_type="APPROVED_REFUND_SETTLEMENT",
            amount_inr=req.amount_inr,
            simulated=True,
            reference_id=tx_ref,
            reconciliation_status="RECONCILED",
            description=f"Partner-approved refund settlement ({legal_ref} / {partner_ref})",
        )
        notif = Notification(
            id=gen_id("ntf"),
            user_id=req.user_id,
            title="Restricted Balance Settled",
            message=f"Settlement of ₹{req.amount_inr} recorded under {legal_ref} (Ref: {tx_ref}).",
            category="SETTLEMENT",
        )
        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role=g.admin_role,
            action="PARTNER_SETTLEMENT_RECORDED",
            entity_type="settlement_requests",
            entity_id=req.id,
            summary=f"Settled ₹{req.amount_inr} | Legal: {legal_ref} | Partner: {partner_ref} | Tx: {tx_ref}",
        )
        db.session.add_all([refund_tx, notif, audit])
        db.session.commit()
        return jsonify({"id": req.id, "status": req.status, "transaction_ref": req.transaction_ref})

    @app.get("/api/payment-accounts")
    @require_auth
    def list_payment_accounts():
        accounts = (
            PaymentAccount.query.filter_by(user_id=g.current_user.id)
            .order_by(PaymentAccount.is_primary.desc(), PaymentAccount.created_at.desc())
            .all()
        )
        return jsonify(
            {
                "payment_accounts": [
                    {
                        "id": a.id,
                        "account_type": a.account_type,
                        "holder_name": a.holder_name,
                        "account_label": a.account_label,
                        "upi_app": a.upi_app,
                        "upi_vpa_masked": a.upi_vpa_masked,
                        "bank_name": a.bank_name,
                        "ifsc_code": a.ifsc_code,
                        "account_number_masked": a.account_number_masked,
                        "account_last4": a.account_last4,
                        "is_primary": a.is_primary,
                        "simulated_mode": a.simulated_mode,
                        "verification_status": a.verification_status,
                    }
                    for a in accounts
                ]
            }
        )

    @app.post("/api/payment-accounts")
    @require_auth
    @require_csrf
    def register_payment_account():
        data = request.get_json(silent=True) or {}
        account_type = (data.get("account_type") or "").strip().upper()
        if account_type not in ("UPI_VPA", "BANK_ACCOUNT"):
            return jsonify({"error": "account_type must be UPI_VPA or BANK_ACCOUNT"}), 400

        holder_name = (data.get("holder_name") or "").strip()[:120]
        account_label = (data.get("account_label") or "").strip()[:80]
        if not holder_name or not account_label:
            return jsonify({"error": "holder_name and account_label are required"}), 400

        existing = PaymentAccount.query.filter_by(user_id=g.current_user.id).all()
        set_primary = bool(data.get("is_primary", len(existing) == 0))
        acc_id = gen_id("pa")

        if account_type == "UPI_VPA":
            upi_app = (data.get("upi_app") or "GPAY").strip().upper()
            upi_vpa = (data.get("upi_vpa") or "").strip()
            if upi_app not in UPI_APP_SCHEMES:
                return jsonify({"error": "Unsupported upi_app"}), 400
            if not UPI_VPA_RE.match(upi_vpa):
                return jsonify({"error": "Invalid UPI VPA format"}), 400
            account = PaymentAccount(
                id=acc_id,
                user_id=g.current_user.id,
                account_type="UPI_VPA",
                holder_name=holder_name,
                account_label=account_label,
                upi_app=upi_app,
                upi_vpa_masked=mask_upi_vpa(upi_vpa),
                is_primary=set_primary,
                simulated_mode=True,
                verification_status="SIMULATED_VERIFIED",
            )
            audit_summary = f"Registered masked UPI account ({upi_app}: {account.upi_vpa_masked})"
        else:
            bank_name = (data.get("bank_name") or "").strip()[:80]
            ifsc_code = re.sub(r"\s+", "", (data.get("ifsc_code") or "").strip().upper())
            raw_acct = re.sub(r"[\s-]+", "", str(data.get("account_number") or ""))
            if len(bank_name) < 2:
                return jsonify({"error": "Valid bank_name is required"}), 400
            if not IFSC_RE.match(ifsc_code):
                return jsonify({"error": "Invalid 11-character Indian IFSC code"}), 400
            if not BANK_ACCOUNT_RE.match(raw_acct):
                return jsonify({"error": "Bank account number must be 9 to 18 numeric digits"}), 400
            masked_acct, last4 = mask_bank_account(raw_acct)
            account = PaymentAccount(
                id=acc_id,
                user_id=g.current_user.id,
                account_type="BANK_ACCOUNT",
                holder_name=holder_name,
                account_label=account_label,
                bank_name=bank_name,
                ifsc_code=ifsc_code,
                account_number_masked=masked_acct,
                account_last4=last4,
                is_primary=set_primary,
                simulated_mode=True,
                verification_status="SIMULATED_VERIFIED",
            )
            audit_summary = f"Registered masked bank account ({bank_name} {masked_acct}, IFSC {ifsc_code})"

        if set_primary:
            for prev_acc in existing:
                if prev_acc.is_primary:
                    prev_acc.is_primary = False

        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role="USER",
            action="PAYMENT_ACCOUNT_REGISTERED",
            entity_type="payment_accounts",
            entity_id=acc_id,
            summary=audit_summary,
        )
        db.session.add_all([account, audit])
        db.session.commit()
        return jsonify(
            {
                "id": account.id,
                "account_type": account.account_type,
                "account_label": account.account_label,
                "upi_vpa_masked": account.upi_vpa_masked,
                "account_number_masked": account.account_number_masked,
                "ifsc_code": account.ifsc_code,
                "is_primary": account.is_primary,
                "simulated_mode": True,
            }
        ), 201

    @app.patch("/api/payment-accounts/<account_id>/primary")
    @require_auth
    @require_csrf
    def set_primary_payment_account(account_id):
        target = PaymentAccount.query.filter_by(id=account_id, user_id=g.current_user.id).first()
        if not target:
            return jsonify({"error": "Payment account not found"}), 404
        for acc in PaymentAccount.query.filter_by(user_id=g.current_user.id).all():
            acc.is_primary = acc.id == account_id
        db.session.commit()
        return jsonify({"id": target.id, "is_primary": True})

    @app.delete("/api/payment-accounts/<account_id>")
    @require_auth
    @require_csrf
    def delete_payment_account(account_id):
        target = PaymentAccount.query.filter_by(id=account_id, user_id=g.current_user.id).first()
        if not target:
            return jsonify({"error": "Payment account not found"}), 404
        audit = AuditLog(
            id=gen_id("aud"),
            actor_uid=g.current_user.id,
            actor_role="USER",
            action="PAYMENT_ACCOUNT_REMOVED",
            entity_type="payment_accounts",
            entity_id=account_id,
            summary=f"Removed registered payment account '{target.account_label}'.",
        )
        db.session.delete(target)
        db.session.add(audit)
        db.session.commit()
        return jsonify({"deleted": account_id})

    @app.get("/api/admin/missed-challenges-summary")
    @require_admin()
    def admin_missed_challenges_summary():
        try:
            spread_pct = Decimal(str(request.args.get("partner_spread_pct", "1.5")))
        except Exception:
            return jsonify({"error": "Invalid partner_spread_pct"}), 400
        if spread_pct < Decimal("0") or spread_pct > Decimal("25"):
            return jsonify({"error": "partner_spread_pct must be between 0 and 25"}), 400

        failed_challenges = Challenge.query.filter_by(status="FAILED").all()
        all_challenges = Challenge.query.all()
        broken_streaks_count = Streak.query.filter_by(streak_broken=True).count()
        missed_saved_inr = sum((Decimal(c.total_saved_inr) for c in failed_challenges), Decimal("0"))
        missed_planned_inr = sum((Decimal(c.total_planned_inr) for c in failed_challenges), Decimal("0"))
        missed_gap_inr = max(Decimal("0"), missed_planned_inr - missed_saved_inr)
        total_volume_inr = sum((Decimal(c.total_saved_inr) for c in all_challenges), Decimal("0"))
        total_bonus_outflow = sum(
            (Decimal(r.bonus_amount_inr) for r in RewardRecord.query.all()), Decimal("0")
        )
        illustrative_spread_inr = (
            (total_volume_inr * spread_pct) / Decimal("100")
        ).quantize(Decimal("0.01"))
        net_illustrative_profit_inr = (illustrative_spread_inr - total_bonus_outflow).quantize(
            Decimal("0.01")
        )

        return jsonify(
            {
                "admin_only": True,
                "failed_challenges_count": len(failed_challenges),
                "broken_streaks_count": broken_streaks_count,
                "missed_challenge_principal_inr": float(missed_saved_inr),
                "missed_uncollected_gap_inr": float(missed_gap_inr),
                "forfeited_profit_from_missed_inr": 0.0,
                "profit_projection": {
                    "simulated_only": True,
                    "partner_spread_pct": float(spread_pct),
                    "total_simulated_volume_inr": float(total_volume_inr),
                    "illustrative_partner_spread_inr": float(illustrative_spread_inr),
                    "illustrative_bonus_outflow_inr": float(total_bonus_outflow),
                    "net_illustrative_profit_inr": float(net_illustrative_profit_inr),
                },
                "failed_challenges": [
                    {
                        "id": c.id,
                        "user_id": c.user_id,
                        "plan_code": c.plan_code,
                        "description": (
                            f"{c.plan_code} · Day {c.completed_days}/{c.duration_days} "
                            f"· Start ₹{c.start_amount_inr} (+₹{c.increment_amount_inr}/day)"
                        ),
                        "cause": c.failed_reason or "Missed daily deposit deadline",
                        "completed_days": c.completed_days,
                        "duration_days": c.duration_days,
                        "principal_preserved_inr": float(c.total_saved_inr),
                        "missed_planned_gap_inr": float(
                            max(Decimal("0"), Decimal(c.total_planned_inr) - Decimal(c.total_saved_inr))
                        ),
                    }
                    for c in failed_challenges
                ],
            }
        )

    return app


if __name__ == "__main__":
    application = create_app()
    with application.app_context():
        db.create_all()
    application.run(host="0.0.0.0", port=int(os.environ.get("FLASK_PORT", 5000)))
