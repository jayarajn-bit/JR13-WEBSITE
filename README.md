# JR13 SAVINGS — Save Daily. Build Your Future.

A responsive Indian Rupee (₹) daily savings challenge platform with progressive deposit scheduling, streak tracking, non-confiscatable restricted-funds governance, and a compliance reconciliation admin console.

## Project Structure
- `src/` — React 19 + TypeScript + Tailwind CSS v4 frontend (Dashboard, Challenge Selector & Full Schedule Preview, Daily Savings Calendar, Ledger & Settlement History, Alerts, Profile, Admin Governance Console)
- `firestore.rules` & `firebase-blueprint.json` — Hardened Firestore security rules and entity schema
- `backend/` — Complete Python Flask REST API (`app.py`, `models.py`, `security.py`, `services/challenge_engine.py`, `migrations/001_initial_schema.sql`, `seed.py`, `tests/test_jr13_savings.py`)
- `docs/` — `API.md`, `VSCODE_SETUP.md`, `DEPLOYMENT.md`

## Challenge Tiers (Proposed Illustrative Rates)
- **49 Days**: `2%` one-time illustrative completion bonus
- **99 Days**: `4%` one-time illustrative completion bonus
- **299 Days**: `5%` one-time illustrative completion bonus
- **364 Days**: `8%` one-time illustrative completion bonus

Formula: `bonus = eligible_savings × rate / 100`. Proposed illustrative rates only; not guaranteed returns.
