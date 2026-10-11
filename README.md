# Finenzo — Mobile-First Personal Finance App

**Finenzo** is a calm, production-ready, mobile-first personal finance web application built as a monorepo with a Node.js + Express + MongoDB backend and a React (Vite) PWA frontend.

Designed with a warm, editorial, Claude-inspired design aesthetic, Finenzo tracks monthly budget cycles, daily expenses, recurring subscriptions, income top-ups, and money lent to or borrowed from friends.


---

## Table of Contents
1. [Architecture & Stack](#architecture--stack)
2. [Features](#features)
3. [Repository Structure](#repository-structure)
4. [Environment Variables](#environment-variables)
5. [Google OAuth 2.0 Setup](#google-oauth-20-setup)
6. [Local Development (Without Docker)](#local-development-without-docker)
7. [Running with Docker & Docker Compose](#running-with-docker--docker-compose)
8. [Testing & Quality](#testing--quality)
9. [Security Considerations & Trade-offs](#security-considerations--trade-offs)
10. [Design System & Mobile UX](#design-system--mobile-ux)

---

## 1. Architecture & Stack

### Server
- **Runtime**: Node.js (LTS), Express 5, native ES modules (`"type": "module"`).
- **Database**: MongoDB with Mongoose (with indexes on `userId`, `cycleId + date`, `nextRenewal`).
- **Auth**: Google ID token verification via `google-auth-library` (never trust client profile fields) + `jsonwebtoken` for 7–30 day session tokens.
- **Validation**: Strict schema validation via `zod` on every request.
- **Security**: `helmet`, strict CORS allow-list, `express-rate-limit` (extra strict on `/auth`), body size limits, input sanitization.
- **Testing**: Vitest with unit & integration tests covering parsers, renewal calculations, projection math, and API routes.

### Client
- **Framework**: React 18, Vite 6, React Router 6.
- **State Management**: TanStack Query (React Query v5).
- **Styling**: Tailwind CSS with CSS custom variables for dynamic, accessible accent theming.
- **Typography**: Self-hosted `@fontsource-variable/newsreader` (editorial serif for headings and large figures) and `@fontsource-variable/inter` (humanist sans for body/UI).
- **Icons & Visuals**: `lucide-react`.
- **Charts**: Lightweight, lazy-loaded spending charts via `recharts`.
- **PWA**: `vite-plugin-pwa` with service worker, app manifest, installable on mobile Chrome (Android), and read-only offline caching.

---

## 2. Features

- **Budget Cycles & Starting Balance Expressions**:
  - Organised into cycles with customizable start day (e.g. 1st or 25th for salary/pay days).
  - Expression starting balance: e.g. `122K + 30k + 30k` = `182,000`. Preserves and displays original expression.
  - One-tap cycle close with carry-over of remaining balance into the next cycle.
  - History switcher between current and past cycles.
- **Smart Amount Parser & Quick-Add Bar**:
  - Parses `5k`, `1.5k`, `500`, `2K`, `1.2m`, `1,500`, and sums `3k + 500`.
  - One-line quick-add input: `5k : Qari faiz 4oct` or `1.5k movie box`.
  - Date extraction supports formats like `4oct`, `4 Oct`, `4/10`, `today`, `yesterday`.
- **Bulk Paste Import**:
  - Paste multi-line raw notes, preview parsed rows with instant validation, highlighted errors, and editable fields before confirming.
  - Compares declared `Total :` lines with the parsed sum and alerts on mismatch.
- **Dashboard & Projections**:
  - Remaining balance card with real-time projections:
    - Safe to spend per day: `(remaining − upcoming renewals this cycle) ÷ days left`.
    - Projected end-of-cycle balance at current daily average.
    - Warning indicator if projection turns negative.
  - Upcoming renewals strip (7 days and 30 days).
  - Daily spending bar chart and category breakdowns.
- **Subscriptions & Recurring Charges**:
  - Multiple line items per subscription (e.g., Apple Cloud `300 + 300`).
  - Monthly, quarterly, yearly, custom N-month, and manual cycles with month-end edge case clamping (31st in 30-day month, Feb 29).
  - One-tap "Mark paid" (creates a linked expense without double counting) or "Charge now" for manual items.
  - Skip, pause, resume, cancel, and price change history tracking.
- **Friends & Lending**:
  - Track loans lent or borrowed.
  - Partial repayment history with automatic status computation (`pending`, `partial`, `returned`, `overdue`).
  - Optional toggle to create linked expenses on loan disbursement and income credits on repayment.
  - WhatsApp nudge button (`https://wa.me/?text=...`) with pre-filled friendly reminder messages.
- **Income / Mid-Month Top-ups**:
  - Add mid-month top-ups and bonuses that increase the remaining balance.
- **Settings & Theming**:
  - Dynamic WCAG AA accessible accent color picker (Terracotta, Blue, Green, Purple, Pink, Teal, Amber, or custom Hex). Persisted on server and mirrored in `localStorage` for zero theme flash.
  - Compact number formatting toggle (`182k` vs `182,000`).
  - Full data backup (JSON) and CSV export for Excel/Google Sheets.
  - Complete JSON restore, wipe data, and account deletion.

---

## 3. Repository Structure

```
finenzo/
├── server/
│   ├── src/
│   │   ├── config.js
│   │   ├── http.js
│   │   ├── models.js
│   │   ├── schemas.js
│   │   ├── app.js
│   │   ├── index.js
│   │   ├── lib/
│   │   │   ├── dates.js
│   │   │   ├── google.js
│   │   │   ├── loans.js
│   │   │   ├── money.js
│   │   │   ├── noteParser.js
│   │   │   ├── projections.js
│   │   │   └── renewal.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── cycles.js
│   │   │   ├── dashboard.js
│   │   │   ├── data.js
│   │   │   ├── expenses.js
│   │   │   ├── friends.js
│   │   │   └── subscriptions.js
│   │   └── services/
│   │       ├── cycles.js
│   │       └── subscriptions.js
│   ├── test/
│   │   ├── api.test.js
│   │   ├── logic.test.js
│   │   └── parsers.test.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── client/
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── pwa-192.png
│   │   ├── pwa-512.png
│   │   ├── pwa-maskable-512.png
│   │   └── apple-touch-icon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── AmountInput.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── Logo.jsx
│   │   │   ├── PullToRefresh.jsx
│   │   │   ├── Sheet.jsx
│   │   │   ├── SpendChart.jsx
│   │   │   ├── SwipeRow.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── ui.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── CycleContext.jsx
│   │   ├── forms/
│   │   │   ├── BulkImportSheet.jsx
│   │   │   ├── CycleForms.jsx
│   │   │   ├── ExpenseSheet.jsx
│   │   │   ├── LendingForms.jsx
│   │   │   ├── QuickAddBar.jsx
│   │   │   └── SubscriptionSheet.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── dates.js
│   │   │   ├── money.js
│   │   │   ├── queries.js
│   │   │   ├── theme.js
│   │   │   └── undo.js
│   │   ├── pages/
│   │   │   ├── Categories.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DataSettings.jsx
│   │   │   ├── Expenses.jsx
│   │   │   ├── FriendDetail.jsx
│   │   │   ├── Friends.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Subscriptions.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── scripts/
│   │   └── make-icons.mjs
│   ├── test/
│   │   └── lib.test.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── docker-compose.yml
├── .gitignore
├── eslint.config.js
├── .prettierrc
├── package.json
└── README.md
```

---

## 4. Environment Variables

### Server (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```ini
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/finenzo
# Generate 48 random bytes: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your-random-32-character-secret
JWT_EXPIRES_IN=30d
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
CLIENT_ORIGIN=http://localhost:5173
DEFAULT_TIMEZONE=Asia/Karachi
```

### Client (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```ini
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

---

## 5. Google OAuth 2.0 Setup

Finenzo uses Google Sign-In as its sole authentication mechanism.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Select **Application type**: `Web application`.
6. Name it (e.g. `Finenzo Web`).
7. Under **Authorized JavaScript origins**, add:
   - For local development: `http://localhost:5173` and `http://localhost:4000`
   - For production: Your domain (e.g., `https://finenzo.example.com`)
8. Save and copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
9. Paste this Client ID into:
   - `server/.env` under `GOOGLE_CLIENT_ID`
   - `client/.env` under `VITE_GOOGLE_CLIENT_ID`

---

## 6. Local Development (Without Docker)

### Prerequisites
- Node.js LTS (v20+ or v22+)
- MongoDB running locally (default: `mongodb://127.0.0.1:27017`)

### 1. Install dependencies
From the repository root:
```bash
npm install
```
This automatically installs root dependencies and workspaces (`server` and `client`).

### 2. Generate PWA icons
```bash
npm run icons -w client
```

### 3. Run development servers
```bash
npm run dev
```
This starts both:
- **Server**: `http://localhost:4000` (Node with `--watch`)
- **Client**: `http://localhost:5173` (Vite dev server)

Open `http://localhost:5173` in your browser (or use Chrome DevTools in Mobile Emulation mode).

---

## 7. Running with Docker & Docker Compose

When ready to run with Docker:

1. Ensure `.env` is populated with `MONGODB_URI`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID`.
2. Start the stack:
   ```bash
   docker compose up --build
   ```
3. Services:
   - `finenzo-server`: Node.js API on `:4000` (connects directly to your deployed MongoDB Atlas URI)
   - `finenzo-client`: Production Nginx serving built static PWA assets on `:8080`

---

## 8. Testing & Quality

### Run Server Tests
```bash
npm run test -w server
```
Includes:
- Amount and note line parser tests (validating the example formats, tolerances, typos, sums, and `Total :` reconciliation).
- Schedule & renewal edge cases (monthly 31st, leap day Feb 29, yearly, quarterly).
- Projection math and loan status logic.
- Full API integration tests (Google auth mocking, user isolation, bulk import, cycles, subscriptions, lending, and backup/restore).

### Run Client Tests
```bash
npm run test -w client
```
Validates amount calculations, compact formatting, and WCAG AA contrast derivation for all theme palettes.

### Run All Tests
```bash
npm test
```

### Build Client
```bash
npm run build
```

---

## 9. Security Considerations & Trade-offs

- **Session Tokens in `localStorage`**:
  - *Trade-off*: `localStorage` allows instant app open, offline profile hydration, and avoids third-party cookie blocking on modern mobile browsers, but carries vulnerability if client-side code execution (XSS) occurs.
  - *Mitigations*:
    1. Helmet headers on server enforcing strict script and style security.
    2. Strict input sanitization and zero usage of `dangerouslySetInnerHTML`.
    3. Formula injection mitigation in CSV exports (cells starting with `=`, `+`, `-`, `@` are safely quoted).
    4. JWT expiry configured (default 30 days) with auto-logout on 401.
- **Strict User Scoping**: Every MongoDB operation is scoped directly to `req.userId` extracted from the cryptographically verified JWT payload. Cross-user access is impossible.
- **Server Token Verification**: Google ID tokens are verified directly against Google OAuth certificates using `google-auth-library`. Client profile claims are completely ignored.

---

## 10. Design System & Mobile UX

- **Mobile First**: Built specifically for phone viewports (360–430px) with bottom tab bar, bottom sheets for forms, swipe actions, pull-to-refresh, minimum 44×44px touch targets, and inputs ≥ 16px to prevent viewport zoom.
- **Typography & Aesthetics**: Warm off-white background (`#FAF9F5`), terracotta accents, Newsreader serif headings, and tabular numerals for financial figures.
- **PWA Installation**: Open in Chrome on Android and tap **"Add to Home screen"** or **"Install Finenzo"** for fullscreen standalone experience.
