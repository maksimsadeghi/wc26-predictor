# WC26 Predictor

Predict every match of the 2026 World Cup, earn points, and compete on a live leaderboard with friends.

---

## Setup (15 minutes)

### 1. Clone and install

```bash
cd wc26-predictor
npm install
```

### 2. Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Name it `wc26-predictor`, disable Google Analytics (optional)
3. **Authentication** → Get started → Google → Enable → Save
4. **Firestore** → Create database → Start in **production mode** → choose a region
5. **Project Settings** → Your apps → **</>** (Web) → Register app → copy the config

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in your Firebase config values into `.env`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

### 4. API-Football key

1. Sign up free at [dashboard.api-football.com/register](https://dashboard.api-football.com/register)
2. Free tier = 100 requests/day — plenty for the tournament
3. Add to `.env`:

```
VITE_API_FOOTBALL_KEY=your_key_here
```

### 5. Firestore security rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point to your project
firebase deploy --only firestore:rules
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

Your app will be live at `https://your-project.web.app`

Share that URL with friends — they sign in with Google and join your league with the 6-letter code.

---

## Project structure

```
src/
├── context/
│   └── AuthContext.jsx     # Google auth provider
├── pages/
│   ├── Login.jsx           # Google sign-in screen
│   ├── Home.jsx            # Create / join league
│   ├── League.jsx          # League settings + invite
│   ├── Predictions.jsx     # All match cards
│   └── Leaderboard.jsx     # Live points table
├── components/
│   ├── Nav.jsx             # Top navigation bar
│   └── MatchCard.jsx       # Score picker + bonus dropdowns
├── services/
│   ├── apiFootball.js      # Match data + squad fetching
│   └── firestore.js        # All DB reads/writes + scoring engine
├── firebase.js             # Firebase initialisation
└── index.css               # Global dark theme styles
```

---

## Scoring

| Event | Points |
|---|---|
| Correct result (win/draw/loss) | 5 pts |
| Exact correct scoreline | 8 pts |
| First team to score (bonus) | +1 pt |
| First goalscorer (bonus) | +2 pts |

Predictions lock **1 hour before kickoff**. Results are fetched automatically from API-Football after the match ends, and the leaderboard updates in real-time via Firestore.

---

## How results get scored

After each match finishes, the scoring engine in `src/services/firestore.js → recalcLeaderboard()` compares every prediction against the actual result and updates the `scores` collection. The leaderboard page subscribes to this collection in real-time so everyone sees updates instantly.

Call `recalcLeaderboard(leagueId)` from your browser console or a small admin page after confirming a result has been written to the `results` collection.

---

## Scheduled prefetch (staying under 100 req/day)

The free API-Football tier gives 100 requests/day. The daily fetch script uses up to **80/day** — leaving headroom for manual fixes.

### What it does each run
1. Caches all 104 fixtures (1 call, one time ever)
2. Fetches 10 squad rosters per day until all 48 teams are cached (~5 days)
3. Fetches results for any match that finished in the last 24h
4. Stops at 80 calls and resumes tomorrow

### One-time setup: get your service account key

1. Firebase Console → Project Settings → **Service accounts** tab
2. Click **Generate new private key** → download the JSON
3. Rename it `serviceAccount.json` and place it in the project root
4. It's already in `.gitignore` — never commit this file

### Install script dependencies

```bash
npm install
```

### Test it manually first

```bash
npm run fetch
```

You'll see output like:
```
🚀  WC26 Prefetch — 2026-06-01T06:00:00.000Z
    Budget: 80 API calls this run

📅  Checking fixtures cache…
  [API call 1/80] GET /fixtures?league=1&season=2026
  ✓  Cached 104 fixtures

👕  Checking squad cache…
  48 squads missing — fetching 10 this run
  [API call 2/80] GET /players/squads?team=6
  ✓  Squad 6 cached (26 players)
  ...

🏁  Checking result cache…
  Results: 0 fetched, 0 already cached, 0 failed

✅  Done — used 11/80 API calls
```

### Schedule it — Mac (cron)

Open crontab:
```bash
crontab -e
```

Add this line (runs every 30 minutes — the script skips automatically during the 3 AM–9 AM ET quiet window):
```
*/30 * * * * cd /full/path/to/wc26-predictor && node scripts/daily-fetch.js >> logs/fetch.log 2>&1
```

Replace `/full/path/to/wc26-predictor` with your actual path (run `pwd` in the project folder to get it).

### Schedule it — Windows (Task Scheduler)

1. Open **Task Scheduler** → Create Basic Task
2. **Name**: WC26 Daily Fetch
3. **Trigger**: Daily at 6:00 AM
4. **Action**: Start a program
   - Program: `node`
   - Arguments: `scripts/daily-fetch.js`
   - Start in: `C:\path\to\wc26-predictor`
5. Finish

### Logs

Each run appends to `logs/fetch.log`. Check it anytime:
```bash
tail -50 logs/fetch.log
```

### API call budget breakdown

| Phase | Calls | When |
|---|---|---|
| Fixtures (all 104 matches) | 1 | Day 1 only |
| Squads (48 teams × 1) | 48 total, 10/day | First ~5 days |
| Results (104 matches × 1) | 104 total, 3–6/day | Throughout tournament |
| **Total across tournament** | **~153** | Well within limits |
