# JR13 SAVINGS — Production Deployment & Compliance Guide

## 1. Regulatory Pre-Flight (Mandatory Before Real-Money Launch)
- **Simulated Mode Only by Default**: Do **not** connect real-money collection, escrow payout, or deposit-taking gateways until:
  1. Qualified Indian legal counsel completes regulatory review (RBI / SEBI / Payment Aggregator applicability).
  2. An authorized regulated Indian bank or RBI-licensed payment partner approves the full custody, restricted-balance, and refund settlement flow.
- **Disclosures**: Maintain clear disclosures that proposed completion bonus rates (`2%`, `4%`, `5%`, `8%`) are illustrative only and not guaranteed returns or bank deposit interest.

## 2. Infrastructure & Security Checklist
- **TLS / Encryption in Transit**: Terminate HTTPS via Cloud Run / Nginx / Load Balancer with HSTS (`Strict-Transport-Security`).
- **Database**: Provision managed PostgreSQL with SSL required (`sslmode=require`), automated daily backups, and point-in-time recovery.
- **Secrets Management**: Store `FLASK_SECRET_KEY`, `POSTGRES_DATABASE_URL`, and `GOOGLE_OAUTH_CLIENT_ID` in secret manager / environment variables—never in source control.
- **Process Runner**:
  - Frontend: `npm run build` and serve `dist/` behind CDN/Nginx.
  - Flask Backend: `gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"`.
- **Firebase Rules**: Deploy `firestore.rules` and review admin allowlists before opening to external users.
