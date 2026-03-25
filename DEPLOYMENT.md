# Deployment Review and Preparation

## Frontend
- Build command: `npm run build` in `client/`
- Required environment variables:
  - `VITE_API_BASE_URL`
  - `VITE_SOCKET_URL`
- Dockerfile included at `client/Dockerfile`

## Backend
- Start command: `npm run start` in `server/`
- Required environment variables:
  - `PORT`
  - `DATABASE_URL`
  - `CLIENT_URL`
- Backend now auto-initializes required tables and columns at startup.
- Dockerfile included at `server/Dockerfile`

## New Features Included in Deployment Scope
- Role-based login and permissions (`/api/auth/login`, JWT).
- Business settings API: `/api/settings`
- Loyalty APIs: `/api/loyalty/leaderboard`, `/api/loyalty/:phone`, `/api/loyalty/redeem`
- Messaging APIs: `/api/messages`
- Promotions APIs: `/api/promotions/codes`, `/api/promotions/happy-hours`
- Inventory APIs: `/api/inventory/ingredients`, `/api/inventory/alerts/low-stock`
- Monitoring APIs: `/api/monitoring/health`, `/api/monitoring/uptime`
- Orders support filtering, CSV/PDF export, and sales summaries.
- Orders support discounting (`promo_code`, happy-hour), priorities, and IN_PROGRESS workflow.
- Orders now support `special_notes`.
- Twilio SMS and WhatsApp notifications when orders become ready.
- Admin user management API and backup administration API.

## Docker Compose (Local Validation)
- File: `docker-compose.yml`
- Run:
  1. Set `DATABASE_URL` in your shell environment.
  2. `docker compose up --build`

## Production Checklist
1. Set strong PostgreSQL credentials and secure network access.
2. Configure `CLIENT_URL` to your deployed frontend URL.
3. Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to deployed backend URL.
4. Enable HTTPS and reverse proxy for WebSocket upgrade support.
5. Add auth/role checks for admin routes before public production use.
6. Replace default seeded passwords immediately in production.
7. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, and `TWILIO_WHATSAPP_FROM`.
8. Ensure PostgreSQL CLI tools are available on the host (`pg_dump`, `pg_restore`).
9. Configure backup retention and schedule: `DB_BACKUP_RETENTION_DAYS`, `DB_BACKUP_CRON`.

## Backup and Restore
- Manual backup: `npm run backup` in `server/`
- Manual restore: `npm run restore -- <backup-file-name.dump>` in `server/`
- Scheduled backups are executed automatically at `DB_BACKUP_CRON` and old backups are deleted based on `DB_BACKUP_RETENTION_DAYS`.
