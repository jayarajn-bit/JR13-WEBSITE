from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import uuid

PLAN_CATALOG = {
    "1D_0PCT": {"duration_days": 1, "bonus_rate": Decimal("0.00"), "title": "1-Day Streak"},
    "49D_2PCT": {"duration_days": 49, "bonus_rate": Decimal("2.00"), "title": "49-Day Sprint"},
    "99D_4PCT": {"duration_days": 99, "bonus_rate": Decimal("4.00"), "title": "99-Day Foundation"},
    "299D_5PCT": {"duration_days": 299, "bonus_rate": Decimal("5.00"), "title": "299-Day Horizon"},
    "364D_8PCT": {"duration_days": 364, "bonus_rate": Decimal("8.00"), "title": "364-Day Sovereign"},
}


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def day_amount_inr(day_number: int, start_amount: Decimal, increment_amount: Decimal) -> Decimal:
    if day_number < 1:
        raise ValueError("day_number must be >= 1")
    return (start_amount + (Decimal(day_number - 1) * increment_amount)).quantize(Decimal("0.01"))


def total_planned_inr(duration_days: int, start_amount: Decimal, increment_amount: Decimal) -> Decimal:
    n = Decimal(duration_days)
    total = (n / Decimal(2)) * ((Decimal(2) * start_amount) + ((n - Decimal(1)) * increment_amount))
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def illustrative_bonus_inr(eligible_savings: Decimal, bonus_rate_pct: Decimal) -> Decimal:
    return ((eligible_savings * bonus_rate_pct) / Decimal(100)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def build_schedule_preview(duration_days: int, start_amount: Decimal, increment_amount: Decimal, start_date):
    schedule = []
    cumulative = Decimal("0.00")
    for day in range(1, duration_days + 1):
        amt = day_amount_inr(day, start_amount, increment_amount)
        cumulative += amt
        schedule.append(
            {
                "day_number": day,
                "scheduled_date": (start_date + timedelta(days=day - 1)).isoformat(),
                "amount_inr": float(amt),
                "cumulative_inr": float(cumulative),
            }
        )
    return schedule
