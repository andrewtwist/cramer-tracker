# 📈 Cramer Tracker — Beat Mad Money

A full-stack React app that lets two users track their stock portfolios and compare performance against Jim Cramer's Mad Money portfolio in near real-time.

---

## Features

- **Real-time stock prices** via Yahoo Finance (free, no API key) with Finnhub fallback
- **Two user accounts** + admin account managing Cramer's portfolio
- **Portfolio management** — add stocks by symbol + share quantity, set cash balance
- **vs Cramer comparison** — side-by-side allocation, performance delta, shares needed to match his allocation
- **Dashboard** with at-a-glance stats
- **Supabase backend** — auth, database, row-level security
- **Deploy to GitHub Pages** via GitHub Actions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Auth + DB | Supabase |
| Stock Prices | Yahoo Finance (free) / Finnhub |
| Hosting | GitHub Pages |
| Charts | Recharts |

---

## Setup Guide

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cramer-tracker.git
cd cramer-tracker
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and run the entire contents of `supabase_schema.sql`
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Create Your Admin Account

1. Open the app and click **Create Account**
2. Register with your admin email + password
3. Go to **Supabase → SQL Editor** and run:

```sql
UPDATE profiles SET is_admin = TRUE WHERE username = 'your_username';
```

4. Sign out and back in — you'll see the **Admin** panel in the sidebar

### 6. Initialize Cramer's Portfolio

1. Sign in as admin
2. Go to **Admin Panel**
3. Click **Initialize Cramer Portfolio**
4. Start adding Jim Cramer's stock holdings from CNBC Mad Money

> **Where to find Cramer's holdings:** CNBC's website at cnbc.com/mad-money publishes his portfolio. You can also check thestreet.com/jim-cramer.

### 7. Create User Accounts

Two regular users can sign up via the Create Account tab. Each gets their own portfolio.

---

## Deploying to GitHub Pages

### One-time setup:

1. **Enable GitHub Pages** in your repo: Settings → Pages → Source: GitHub Actions

2. **Add secrets** in Settings → Secrets → Actions:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FINNHUB_API_KEY` (optional)

3. **Update `vite.config.js`** if deploying to a subdirectory (e.g. github.io/repo-name):
```js
export default defineConfig({
  base: '/cramer-tracker/', // your repo name
  // ...
})
```

4. Push to `main` branch — GitHub Actions will build and deploy automatically.

---

## Stock Price API Notes

### Primary: Yahoo Finance (No API key needed)
- Completely free via AllOrigins CORS proxy
- ~3 minute refresh delay (near real-time)
- Rate limited: the app batches requests with small delays

### Fallback: Finnhub (Free tier)
- Sign up free at [finnhub.io](https://finnhub.io)
- 60 requests/minute on free tier
- Add `VITE_FINNHUB_API_KEY` to environment

### Market Hours
The app shows a live MARKET OPEN / CLOSED indicator based on US Eastern time (Mon-Fri 9:30am-4:00pm ET).

---

## Comparison Logic

**"Shares Needed to Match Cramer's Allocation"** calculates:
1. What % of Cramer's portfolio does each stock represent
2. What that same % would be worth in YOUR portfolio (scaled to your total)  
3. How many shares you'd need to buy to reach that target

This lets you benchmark your portfolio proportionally regardless of different total sizes.

---

## Folder Structure

```
src/
├── lib/
│   ├── supabase.js      # DB queries & auth helpers
│   ├── stocks.js        # Price fetching (Yahoo/Finnhub)
│   ├── auth.jsx         # Auth context & hooks
│   └── usePortfolio.js  # Portfolio state management
├── pages/
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── PortfolioPage.jsx
│   ├── ComparePage.jsx
│   └── AdminPage.jsx
├── components/
│   └── Layout.jsx
└── App.jsx
```

---

## FAQ

**Q: Can I track more than 2 users?**  
A: The schema supports unlimited users. The comparison page compares YOUR logged-in portfolio vs Cramer's. You can invite as many users as you want.

**Q: Are prices truly real-time?**  
A: They're near real-time (~3 min delay from Yahoo Finance). The app refreshes every 3 minutes automatically during market hours.

**Q: How do I update Cramer's portfolio?**  
A: Log in as admin → Admin Panel → add/edit/remove holdings. CNBC updates his portfolio disclosures periodically.

**Q: Is this safe to put in a public GitHub repo?**  
A: Yes, as long as you never commit `.env.local`. The Supabase `anon` key is safe to expose — Row Level Security ensures users can only see their own data.
