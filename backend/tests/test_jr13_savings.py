from datetime import date, timedelta
from decimal import Decimal
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from models import (
    AdminUser,
    DailyContribution,
    RestrictedFundsLedger,
    RewardRecord,
    SettlementRequest,
    User,
    db,
)
from security import hash_password
from services.challenge_engine import (
    day_amount_inr,
    illustrative_bonus_inr,
    total_planned_inr,
)


@pytest.fixture()
def client():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-secret-key",
        }
    )
    with app.app_context():
        db.create_all()
        yield app.test_client()


def test_progressive_schedule_math():
    assert day_amount_inr(1, Decimal("10"), Decimal("10")) == Decimal("10.00")
    assert day_amount_inr(2, Decimal("10"), Decimal("10")) == Decimal("20.00")
    assert day_amount_inr(3, Decimal("10"), Decimal("10")) == Decimal("30.00")
    assert total_planned_inr(1, Decimal("10"), Decimal("10")) == Decimal("10.00")
    assert total_planned_inr(49, Decimal("10"), Decimal("10")) == Decimal("12250.00")
    assert total_planned_inr(99, Decimal("10"), Decimal("10")) == Decimal("49500.00")
    assert total_planned_inr(299, Decimal("10"), Decimal("10")) == Decimal("448500.00")
    assert total_planned_inr(364, Decimal("10"), Decimal("10")) == Decimal("664300.00")


def test_illustrative_bonus_formula():
    assert illustrative_bonus_inr(Decimal("12250.00"), Decimal("2")) == Decimal("245.00")
    assert illustrative_bonus_inr(Decimal("49500.00"), Decimal("4")) == Decimal("1980.00")
    assert illustrative_bonus_inr(Decimal("448500.00"), Decimal("5")) == Decimal("22425.00")
    assert illustrative_bonus_inr(Decimal("664300.00"), Decimal("8")) == Decimal("53144.00")


def test_failed_challenge_restricted_ledger_and_admin_spend_prohibition(client):
    # Register user and get CSRF token
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "test.saver@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "Test Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    # Enroll in 49-day challenge
    enroll = client.post(
        "/api/challenges",
        headers={"X-CSRF-Token": csrf},
        json={
            "plan_code": "49D_2PCT",
            "start_amount_inr": 10,
            "increment_amount_inr": 10,
            "start_date": date.today().isoformat(),
        },
    )
    assert enroll.status_code == 201
    chl_id = enroll.get_json()["id"]

    # Day 1 (₹10) succeeds; immediate Day 2 is blocked by 24-hour single-streak rule
    assert client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf}).status_code == 200
    too_soon = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert too_soon.status_code == 429

    # After 24 hours elapse, Day 2 (₹20) succeeds (total = ₹30)
    with client.application.app_context():
        day1 = DailyContribution.query.filter_by(challenge_id=chl_id, day_number=1).first()
        day1.created_at = day1.created_at - timedelta(hours=25)
        db.session.commit()

    assert client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf}).status_code == 200

    # Simulate missed deadline -> locks challenge and creates RestrictedFundsLedger for ₹30
    fail_res = client.post(
        f"/api/challenges/{chl_id}/fail-missed-deadline",
        headers={"X-CSRF-Token": csrf},
    )
    assert fail_res.status_code == 200
    payload = fail_res.get_json()
    assert payload["status"] == "FAILED"
    assert payload["locked"] is True
    assert payload["restricted_ledger_id"] is not None

    # Further contributions MUST be rejected
    blocked = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert blocked.status_code == 409

    # Create admin user and test admin spend prohibition + partner settlement gate
    with client.application.app_context():
        admin_u = User(
            id="adm_1",
            email="admin@jr13.in",
            password_hash=hash_password("AdminPass#13"),
            auth_provider="local",
        )
        admin_r = AdminUser(uid="adm_1", email="admin@jr13.in", role="COMPLIANCE_ADMIN", active=True)
        db.session.add_all([admin_u, admin_r])
        db.session.commit()

    login_adm = client.post(
        "/api/auth/login",
        json={"email": "admin@jr13.in", "password": "AdminPass#13"},
    )
    adm_csrf = login_adm.get_json()["csrf_token"]

    # Admin spend MUST return 403
    spend_res = client.post(
        f"/api/admin/restricted-ledger/{payload['restricted_ledger_id']}/spend",
        headers={"X-CSRF-Token": adm_csrf},
    )
    assert spend_res.status_code == 403

    # Settlement without partner refs MUST fail 400
    bad_settle = client.post(
        f"/api/admin/settlements/{payload['settlement_request_id']}/record-partner-settlement",
        headers={"X-CSRF-Token": adm_csrf},
        json={"legal_approval_ref": "", "partner_bank_ref": "", "transaction_ref": ""},
    )
    assert bad_settle.status_code == 400

    # Valid partner-approved settlement succeeds
    good_settle = client.post(
        f"/api/admin/settlements/{payload['settlement_request_id']}/record-partner-settlement",
        headers={"X-CSRF-Token": adm_csrf},
        json={
            "legal_approval_ref": "LEG-2026-009",
            "partner_bank_ref": "HDFC-ESC-101",
            "transaction_ref": "UTR-SIM-5501",
        },
    )
    assert good_settle.status_code == 200
    assert good_settle.get_json()["status"] == "SETTLED_REFUNDED"


def test_simulated_upi_intent_preview_and_vpa_masking(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "upi.saver@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "UPI Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    # Sandbox UPI Intent preview for PhonePe
    preview = client.post(
        "/api/payments/upi/intent-preview",
        headers={"X-CSRF-Token": csrf},
        json={"upi_app": "PHONEPE", "amount_inr": 10, "upi_vpa": "9876543210@ybl"},
    )
    assert preview.status_code == 200
    pdata = preview.get_json()
    assert pdata["sandbox_mode"] is True
    assert pdata["live_debit_enabled"] is False
    assert pdata["upi_intent_uri"].startswith("phonepe://pay?")
    assert pdata["upi_vpa_masked"] == "98••••10@ybl"

    # Invalid VPA rejected
    bad_preview = client.post(
        "/api/payments/upi/intent-preview",
        headers={"X-CSRF-Token": csrf},
        json={"upi_app": "GPAY", "amount_inr": 10, "upi_vpa": "invalid-vpa"},
    )
    assert bad_preview.status_code == 400

    # Simulated contribution via Google Pay records masked VPA
    enroll = client.post(
        "/api/challenges",
        headers={"X-CSRF-Token": csrf},
        json={
            "plan_code": "49D_2PCT",
            "start_amount_inr": 10,
            "increment_amount_inr": 10,
            "start_date": date.today().isoformat(),
        },
    )
    chl_id = enroll.get_json()["id"]
    contrib = client.post(
        f"/api/challenges/{chl_id}/contribute",
        headers={"X-CSRF-Token": csrf},
        json={"upi_app": "GPAY", "upi_vpa": "ravi.k@okicici"},
    )
    assert contrib.status_code == 200
    cdata = contrib.get_json()
    assert cdata["upi_app"] == "GPAY"
    assert cdata["upi_vpa_masked"] == "ra••••.k@okicici"


def test_register_payment_account_upi_and_bank(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "acct.saver@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "Account Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    # Register UPI payment account
    upi_res = client.post(
        "/api/payment-accounts",
        headers={"X-CSRF-Token": csrf},
        json={
            "account_type": "UPI_VPA",
            "holder_name": "Account Saver",
            "account_label": "PhonePe Wallet",
            "upi_app": "PHONEPE",
            "upi_vpa": "9876543210@ybl",
        },
    )
    assert upi_res.status_code == 201
    upi_data = upi_res.get_json()
    assert upi_data["upi_vpa_masked"] == "98••••10@ybl"
    assert upi_data["is_primary"] is True

    # Invalid IFSC must fail
    bad_bank = client.post(
        "/api/payment-accounts",
        headers={"X-CSRF-Token": csrf},
        json={
            "account_type": "BANK_ACCOUNT",
            "holder_name": "Account Saver",
            "account_label": "HDFC Main",
            "bank_name": "HDFC Bank",
            "ifsc_code": "BADIFSC",
            "account_number": "50100234987123",
        },
    )
    assert bad_bank.status_code == 400

    # Valid bank account masks account digits and sets primary when requested
    bank_res = client.post(
        "/api/payment-accounts",
        headers={"X-CSRF-Token": csrf},
        json={
            "account_type": "BANK_ACCOUNT",
            "holder_name": "Account Saver",
            "account_label": "HDFC Main",
            "bank_name": "HDFC Bank",
            "ifsc_code": "HDFC0000142",
            "account_number": "50100234987123",
            "is_primary": True,
        },
    )
    assert bank_res.status_code == 201
    bank_data = bank_res.get_json()
    assert bank_data["account_number_masked"].endswith("7123")
    assert "5010023498" not in bank_data["account_number_masked"]
    assert bank_data["is_primary"] is True

    # Delete UPI account
    del_res = client.delete(
        f"/api/payment-accounts/{upi_data['id']}",
        headers={"X-CSRF-Token": csrf},
    )
    assert del_res.status_code == 200


def test_one_day_single_streak_challenge(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "oneday.saver@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "One Day Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    # Enroll in 1-day single-streak challenge
    enroll = client.post(
        "/api/challenges",
        headers={"X-CSRF-Token": csrf},
        json={
            "plan_code": "1D_0PCT",
            "start_amount_inr": 50,
            "increment_amount_inr": 10,
            "start_date": date.today().isoformat(),
        },
    )
    assert enroll.status_code == 201
    edata = enroll.get_json()
    assert edata["total_planned_inr"] == 50.0
    chl_id = edata["id"]

    # Day 1 simulated UPI contribution -> completes 1-day streak & locks challenge
    contrib = client.post(
        f"/api/challenges/{chl_id}/contribute",
        headers={"X-CSRF-Token": csrf},
        json={"upi_app": "GPAY", "upi_vpa": "oneday@okaxis"},
    )
    assert contrib.status_code == 200
    cdata = contrib.get_json()
    assert cdata["day_number"] == 1
    assert cdata["amount_inr"] == 50.0
    assert cdata["status"] == "COMPLETED"
    assert cdata["locked"] is True
    assert cdata["current_streak"] == 1
    assert cdata["reward"] is None

    # No further contributions allowed once 1-day challenge is completed
    blocked = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert blocked.status_code == 409

    with client.application.app_context():
        assert RewardRecord.query.filter_by(challenge_id=chl_id).count() == 0


def test_24_hour_streak_cooldown_enforced(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "streak24.saver@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "Streak 24 Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    enroll = client.post(
        "/api/challenges",
        headers={"X-CSRF-Token": csrf},
        json={
            "plan_code": "49D_2PCT",
            "start_amount_inr": 10,
            "increment_amount_inr": 10,
            "start_date": date.today().isoformat(),
        },
    )
    chl_id = enroll.get_json()["id"]

    # First streak succeeds and schedules next unlock +24h
    first = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert first.status_code == 200
    assert "next_streak_unlock_at" in first.get_json()

    # Immediate second streak within 24 hours is rejected with 429
    blocked = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert blocked.status_code == 429
    bdata = blocked.get_json()
    assert bdata["retry_after_seconds"] > 0
    assert "next_unlock_at" in bdata

    # Simulate 24 hours passing -> next streak succeeds
    with client.application.app_context():
        day1 = DailyContribution.query.filter_by(challenge_id=chl_id, day_number=1).first()
        day1.created_at = day1.created_at - timedelta(hours=24, minutes=1)
        db.session.commit()

    second = client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf})
    assert second.status_code == 200
    assert second.get_json()["day_number"] == 2


def test_admin_only_missed_challenges_and_profit_summary(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "saver.summary@jr13.in",
            "password": "StrongPassword#13",
            "full_name": "Summary Saver",
        },
    )
    assert reg.status_code == 201
    csrf = reg.get_json()["csrf_token"]

    enroll = client.post(
        "/api/challenges",
        headers={"X-CSRF-Token": csrf},
        json={
            "plan_code": "49D_2PCT",
            "start_amount_inr": 100,
            "increment_amount_inr": 10,
            "start_date": date.today().isoformat(),
        },
    )
    chl_id = enroll.get_json()["id"]
    assert client.post(f"/api/challenges/{chl_id}/contribute", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert (
        client.post(
            f"/api/challenges/{chl_id}/fail-missed-deadline",
            headers={"X-CSRF-Token": csrf},
            json={
                "cause": "24-Hour Streak Window Expired",
                "description": "Day 2 deposit skipped beyond 24h cutoff",
            },
        ).status_code
        == 200
    )

    # Regular saver MUST receive 403 on Admin-only missed/profit endpoint
    denied = client.get("/api/admin/missed-challenges-summary")
    assert denied.status_code == 403

    with client.application.app_context():
        admin_u = User(
            id="adm_summary",
            email="admin.summary@jr13.in",
            password_hash=hash_password("AdminPass#13"),
            auth_provider="local",
        )
        admin_r = AdminUser(
            uid="adm_summary",
            email="admin.summary@jr13.in",
            role="COMPLIANCE_ADMIN",
            active=True,
        )
        db.session.add_all([admin_u, admin_r])
        db.session.commit()

    client.post(
        "/api/auth/login",
        json={"email": "admin.summary@jr13.in", "password": "AdminPass#13"},
    )
    res = client.get("/api/admin/missed-challenges-summary?partner_spread_pct=2")
    assert res.status_code == 200
    sdata = res.get_json()
    assert sdata["admin_only"] is True
    assert sdata["failed_challenges_count"] == 1
    assert sdata["missed_challenge_principal_inr"] == 100.0
    assert sdata["forfeited_profit_from_missed_inr"] == 0.0
    assert sdata["profit_projection"]["illustrative_partner_spread_inr"] == 2.0
    assert "24-Hour Streak Window Expired" in sdata["failed_challenges"][0]["cause"]
    assert "49D_2PCT" in sdata["failed_challenges"][0]["description"]

