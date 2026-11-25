# JR13 SAVINGS — VS Code Setup Guide

## Prerequisites
- **Node.js 20+** and `npm`
- **Python 3.11+**
- **PostgreSQL 15+**
- **VS Code** with extensions: *Python*, *ESLint*, *Tailwind CSS IntelliSense*, *PostgreSQL*

## 1. Environment Variables
Copy `.env.example` to `.env` in the workspace root and fill in your local credentials:
```bash
cp .env.example .env
```

## 2. Frontend Setup (React + Vite + Tailwind + Firebase Preview)
```bash
npm install
npm run dev
```
Open `http://localhost:3000`. The React frontend supports:
- **Interactive Demo Mode** out of the box (no credentials needed).
- **Google OAuth + Firestore** when signed in via the Account Portal.

## 3. Python Flask + PostgreSQL Backend Setup
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
```

Create the PostgreSQL database and apply the initial migration:
```bash
createdb jr13_savings
psql -d jr13_savings -f migrations/001_initial_schema.sql
python seed.py
```

Run the Flask API server:
```bash
python app.py
```
Flask listens on `http://localhost:5000`.

## 4. Running Automated Tests
```bash
cd backend
pytest -v
```
