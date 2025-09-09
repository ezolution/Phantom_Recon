# Phantom Recon – Project Memory (Persistent)

This document captures the agreed ground truth, decisions, and workflows so future work remains consistent across sessions.

## 0) High‑level
- Name: Threat Intelligence IOC Processing Platform ("Threat‑Forge" UI label)
- Stack: React + Vite + Tailwind CSS (frontend), FastAPI + SQLAlchemy + Pydantic (backend), SQLite (storage), Nginx (reverse proxy + static)
- Containerized via Docker Compose (simple setup, no Redis/Celery/Postgres)

## 1) Non‑negotiable decisions
- No auth/sign‑in required.
- No Redis, no Celery worker/beat.
- Database: SQLite via `sqlite+aiosqlite`, mounted under `./data/`.
- CORS/hosts configured via `.env` (IPs and ports kept current).

## 2) Frontend layout (UI spec)
- Header structure (TopNavigation):
  - Left: hamburger/menu button
  - Center: branding "Threat Intelligence IOC Processing Platform" with shield icon
  - Right: search input immediately to the left of icon buttons (shield, bell, file, code, user, help), all on a single line
- Implementation details:
  - Header is a fixed 64px strip, grid for left/center, right group anchored to right.
  - Right group uses non‑wrapping flex and responsive search width so it never drops below icons.
  - Sidebar (Sidebar component) is a sibling of `<main>`; header spans full width above.
- Files:
  - `frontend/src/components/Navigation.tsx` exports `TopNavigation` and `Sidebar` (split from old single Navigation)
  - `frontend/src/App.tsx` renders `<TopNavigation/>` then a flex row containing `<Sidebar/>` and `<main/>`.
  - `frontend/src/index.css` contains deterministic helper utilities `.topbar`, `.topbar-center`, `.topbar-right`.
- Build pipeline:
  - Tailwind must run in production builds. `frontend/postcss.config.cjs` exists and includes `tailwindcss` + `autoprefixer`.

## 3) Backend
- FastAPI app in `backend/app/main.py` with rate limiting, CORS, trusted hosts, security headers.
- Models adjusted for SQLite compatibility (`JSON` instead of `JSONB`).
- Removed admin/auth dependencies (e.g., jobs endpoints public), re‑exported `Base` in `app.models`.

## 4) Docker / Compose (simple)
- Compose services: `api`, `frontend`, `nginx` only.
- Ports: `api:8000`, `frontend:3000->80`, `nginx:80,443`.
- Nginx upstream to frontend is `frontend:80` (static) and API is `api:8000`.
- `.env` holds `ALLOWED_ORIGINS`, `ALLOWED_HOSTS`, `DATABASE_URL` (SQLite) and API keys.

## 5) Nginx
- Reverse proxy: `/` → frontend; `/api/` → api. Health at `/health`.
- Security headers enabled. Static assets cached with long TTL.

## 6) Deployment workflow (Droplet)
- Rule: all local code edits & git commits happen in chat; droplet commands are provided as single copy‑paste blocks.
- Standard deploy block:
  ```bash
  git pull origin main
  docker-compose down
  docker-compose build frontend
  docker-compose up -d
  docker-compose ps
  curl -I http://<DROPLET_IP>
  ```
- When UI alignment changes are made, only `frontend` needs rebuild (`build frontend`).

## 7) Debug playbooks
- Check services:
  ```bash
  docker-compose ps
  ```
- Inspect built frontend output:
  ```bash
  docker-compose exec frontend sh -lc 'ls -la /usr/share/nginx/html && ls -la /usr/share/nginx/html/assets'
  docker-compose exec frontend sh -lc 'sed -n "1,140p" /usr/share/nginx/html/index.html'
  ```
- Verify header right group DOM exists:
  ```bash
  docker-compose exec nginx sh -lc 'curl -s http://localhost/ | tr -d "\r" | tr ">" ">\n" | grep -n "absolute right-2 top-1/2 -translate-y-1/2" || true'
  ```
- Confirm Tailwind utilities present in compiled CSS (after PostCSS config):
  ```bash
  CSS=$(docker-compose exec nginx sh -lc 'curl -s http://frontend:80 | grep -o "/assets/[^\\\"]*\\.css" | head -n1'); \
  docker-compose exec nginx sh -lc "curl -s http://frontend:80$CSS | grep -n 'flex-wrap:nowrap\|\\.flex-nowrap{\|\\.whitespace-nowrap{\|\\.flex{' | sed -n '1,60p' || true"
  ```

## 8) Known fixes we already applied
- Replaced `JSONB` with `JSON` in models for SQLite.
- Removed admin auth dependencies from endpoints.
- Corrected import for `EnrichmentResult`.
- Re‑exported `Base` from `app.models`.
- Simplified `docker-compose.yml` to SQLite‑only stack; removed Redis/Celery.
- Corrected `nginx.simple.conf` to point frontend upstream to `frontend:80`.
- Added `frontend/postcss.config.cjs` so Tailwind runs in prod and utilities are present in built CSS.

## 9) Conventions
- Single command blocks for droplet actions.
- UI changes should keep the light theme: content `bg-gray-100`, white cards with subtle borders and shadows.
- Branding stays single‑line; search + icons always remain a single line on the right.

## 10) Quick check commands (copy/paste)
```bash
# Deploy latest UI
git pull origin main && docker-compose down && docker-compose build frontend && docker-compose up -d && docker-compose ps && curl -I http://<DROPLET_IP>

# Verify header DOM & CSS utilities
docker-compose exec nginx sh -lc 'curl -s http://localhost/ | tr -d "\r" | tr ">" ">\n" | grep -n "absolute right-2 top-1/2 -translate-y-1/2" || true'
CSS=$(docker-compose exec nginx sh -lc 'curl -s http://frontend:80 | grep -o "/assets/[^\\\"]*\\.css" | head -n1'); \
docker-compose exec nginx sh -lc "curl -s http://frontend:80$CSS | grep -n 'flex-wrap:nowrap\|\\.flex-nowrap{\|\\.whitespace-nowrap{\|\\.flex{' | sed -n '1,60p' || true"
```

## 11) Session notes – Flashpoint + IOC timestamps (2025-09)
- Flashpoint integration
  - Host: `https://api.flashpoint.io` (remove `FLASHPOINT_BASE_URL` override unless pointing there).
  - v2 search limitations: use pagination scan of recent indicators instead of `q`/`value` params.
    - Endpoint: `GET /technical-intelligence/v2/indicators?size=50&from=N&sort=last_seen_at:desc&include_total_count=false`.
    - Scan up to 1000 recent items (20 pages) and match exact `value` client-side.
  - Evidence when not found includes: “Not found in recent 1000 v2 indicators”.
  - ES-style POST fallbacks remain (likely 404 on api.flashpoint.io) and are used after v2 scan.
  - Verdict mapping prefers `score.value` (malicious/suspicious/benign) with normalized output.
  - Provider results are de-duplicated: per IOC+provider we delete older rows before inserting latest.

- IOC first/last seen (DB semantics)
  - On first appearance (no timestamps provided): default both `first_seen` and `last_seen` to the upload time.
  - On re-upload of the same IOC: keep `first_seen` unchanged; set `last_seen` to the new upload time.
  - If CSV provides timestamps, they’re parsed (ISO, `Z` supported) but the re-upload rule above still applies.

- UI updates
  - IOC Details → Overview shows “IOC First Seen” and “IOC Last Seen” (IOC-level fields).
  - Provider panels display provider `first_seen`/`last_seen` when available.
  - Search filters added: `first_seen_from` and `last_seen_to` (datetime-local) wired to backend.

- API changes
  - `GET /api/v1/iocs/` now accepts `first_seen_from` and `last_seen_to` (ISO datetime strings) to filter IOC-level timestamps.
  - Upload endpoint (`POST /api/v1/upload/`) sets defaults and advances `last_seen` on reappearance.

- Deployment reminders
  - After backend changes: `git pull && docker compose up -d --no-deps --build api`.
  - After frontend changes: `docker compose up -d --no-deps --build frontend`.
  - Upload via API may redirect; use trailing slash or `-L`.

---
This file should be kept up to date as decisions evolve. Treat it as the single source of truth for future sessions.
