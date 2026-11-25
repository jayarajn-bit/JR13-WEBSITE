"""Seed sample demo accounts into PostgreSQL for local development."""
from datetime import date
from decimal import Decimal
import os
from app import create_app
from models import AdminUser, Challenge, Profile, Streak, User, db
from security import hash_password
from services.challenge_engine import total_planned_inr


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()
        demo_pw = os.environ.get("JR13_DEMO_PASSWORD", "DemoPass@2026")

        if not User.query.get("demo_saver_arjun"):
            u1 = User(
                id="demo_saver_arjun",
                email="arjun.mehta@demo.jr13.in",
                password_hash=hash_password(demo_pw),
                auth_provider="demo",
            )
            p1 = Profile(
                user_id="demo_saver_arjun",
                full_name="Arjun Mehta",
                phone_masked="+91 98••••4310",
                city="Bengaluru",
                state="Karnataka",
            )
            planned = total_planned_inr(99, Decimal("10"), Decimal("10"))
            c1 = Challenge(
                id="chl_arjun_99d_active",
                user_id="demo_saver_arjun",
                plan_code="99D_4PCT",
                duration_days=99,
                illustrative_bonus_rate=Decimal("4.00"),
                start_amount_inr=Decimal("10.00"),
                increment_amount_inr=Decimal("10.00"),
                total_planned_inr=planned,
                start_date=date.today(),
                next_due_date=date.today(),
            )
            s1 = Streak(id="str_arjun_99d", user_id="demo_saver_arjun", challenge_id=c1.id)
            db.session.add_all([u1, p1, c1, s1])

        if not User.query.get("demo_admin_compliance"):
            admin_user = User(
                id="demo_admin_compliance",
                email="compliance.admin@demo.jr13.in",
                password_hash=hash_password(demo_pw),
                auth_provider="demo",
            )
            admin_profile = Profile(
                user_id="demo_admin_compliance",
                full_name="Kavita Deshmukh",
                city="Mumbai",
                state="Maharashtra",
            )
            admin_role = AdminUser(
                uid="demo_admin_compliance",
                email="compliance.admin@demo.jr13.in",
                role="COMPLIANCE_ADMIN",
                active=True,
            )
            db.session.add_all([admin_user, admin_profile, admin_role])

        db.session.commit()
        print("Seeded JR13 SAVINGS demo accounts successfully.")


if __name__ == "__main__":
    seed()
