#!/usr/bin/env node
/**
 * WC26 Predictor — Daily prefetch script
 *
 * Runs once a day (via cron or Task Scheduler) and fills the Firestore
 * cache with squad + fixture + result data from API-Football.
 *
 * Budget: stays under DAILY_LIMIT calls per run (default 80).
 *
 * Usage:
 *   node scripts/daily-fetch.js
 *
 * Schedule (Mac — add to crontab with `crontab -e`):
 *   0 6 * * * cd /path/to/wc26-predictor && node scripts/daily-fetch.js >> logs/fetch.log 2>&1
 *
 * Schedule (Windows — Task Scheduler):
 *   Program:   node
 *   Arguments: scripts/daily-fetch.js
 *   Start in:  C:\path\to\wc26-predictor
 *   Trigger:   Daily at 6:00 AM
 */

import admin   from 'firebase-admin'
import fetch   from 'node-fetch'
import fs      from 'fs'
import path    from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const require    = createRequire(import.meta.url)

// ── Config ─────────────────────────────────────────────────────────────────

const DAILY_LIMIT    = 1000          // max API calls per run — stays safely under 100/day
const SQUAD_BATCH    = 48         // squads to fetch per run (48 teams ÷ 10 = ~5 days)// Caching all squads first time for now for trial (32)
const WC_LEAGUE_ID   = 1        // FIFA World Cup 1 is World Cup this is just trial
const WC_SEASON      = 2026       //CHANGE BACK JUST TRIAL

// Load env from .env file in project root
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const API_KEY        = process.env.VITE_API_FOOTBALL_KEY
const SERVICE_ACCOUNT = path.resolve(__dirname, '../serviceAccount.json')

if (!API_KEY) {
  console.error('❌  VITE_API_FOOTBALL_KEY not set in .env')
  process.exit(1)
}
if (!fs.existsSync(SERVICE_ACCOUNT)) {
  console.error('❌  serviceAccount.json not found — see setup instructions in README')
  process.exit(1)
}

// ── Firebase Admin ─────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'))),
})
const db = admin.firestore()

// ── API-Football helper ────────────────────────────────────────────────────

let callsThisRun = 0

async function apiGet(path) {
  if (callsThisRun >= DAILY_LIMIT) throw new Error('Daily API limit reached — skipping')
    await new Promise(r => setTimeout(r, 1000)) // wait 1 seconds between calls
    callsThisRun++
  console.log(`  [API call ${callsThisRun}/${DAILY_LIMIT}] GET ${path}`)
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: {
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-rapidapi-key':  API_KEY,
    },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status} on ${path}`)
  const json = await res.json()
  // Respect rate limit header if present
  const remaining = parseInt(res.headers.get('x-ratelimit-requests-remaining') || '999')
  if (remaining < 5) {
    console.warn(`  ⚠️  Only ${remaining} API calls remaining today — stopping early`)
    callsThisRun = DAILY_LIMIT
  }
  return json
}

// ── Step 1: Fixtures ────────────────────────────────────────────────────────

async function ensureFixtures() {
  console.log('\n📅  Checking fixtures cache…')
  const ref    = db.collection('_cache').doc('fixtures_13_2026') //Trial 'fixtures_2026'
  const cached = await ref.get()

  if (cached.exists) {
    const age = Date.now() - cached.data().fetchedAt.toMillis()
    const ageH = Math.round(age / 3600000)
    if (ageH < 6) {
      console.log(`  ✓  Fixtures cached (${ageH}h ago) — skipping`)
      return cached.data().matches
    }
    console.log(`  ♻️  Fixtures cache stale (${ageH}h ago) — refreshing`)
  }

  console.log('  Fetching all fixtures…')
  const data    = await apiGet(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`)
  const matches = data.response.map(normaliseMatch)
  await ref.set({ matches, fetchedAt: admin.firestore.FieldValue.serverTimestamp() })
  console.log(`  ✓  Cached ${matches.length} fixtures`)
  return matches
}

// ── Step 2: Squads ─────────────────────────────────────────────────────────

async function fetchPendingSquads(matches) {
  console.log('\n👕  Checking squad cache…')
  const teamIds = [...new Set(matches.flatMap(m => [m.homeId, m.awayId]))]

  // Find which teams are not yet cached
  const missing = []
  for (const id of teamIds) {
    const snap = await db.collection('_cache').doc(`squad_${id}`).get()
    if (!snap.exists) missing.push(id)
  }

  if (missing.length === 0) {
    console.log('  ✓  All squads cached — skipping')
    return
  }

  const batch = missing.slice(0, SQUAD_BATCH)
  console.log(`  ${missing.length} squads missing — fetching ${batch.length} this run`)

  for (const teamId of batch) {
    if (callsThisRun >= DAILY_LIMIT) { console.log('  ⚠️  Budget reached — will resume tomorrow'); break }
    try {
      const data    = await apiGet(`/players/squads?team=${teamId}`)
      const players = (data.response[0]?.players || []).map(p => ({
        id:  p.id,
        name: p.name,
        pos:  posAbbr(p.position),
      }))
      await db.collection('_cache').doc(`squad_${teamId}`).set({
        players,
        fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`  ✓  Squad ${teamId} cached (${players.length} players)`)
    } catch (e) {
      console.warn(`  ⚠️  Squad ${teamId} failed: ${e.message}`)
    }
  }

  const stillMissing = missing.length - batch.length
  if (stillMissing > 0) {
    console.log(`  ℹ️  ${stillMissing} squads remaining — will fetch over next ${Math.ceil(stillMissing / SQUAD_BATCH)} days`)
  }
}

// ── Step 3: Results ────────────────────────────────────────────────────────

async function fetchPendingResults(matches) {
  console.log('\n🏁  Checking result cache…')

  const now      = Date.now()
  const finished = matches.filter(m => {
    const kickoff = new Date(m.date).getTime()
    return kickoff < now - 5 * 60 * 1000  // kicked off more than 5 minutes ago
  })

  let fetched = 0, skipped = 0, failed = 0

  for (const m of finished) {
    if (callsThisRun >= DAILY_LIMIT) { console.log('  ⚠️  Budget reached — remaining results tomorrow'); break }

    const ref    = db.collection('results').doc(String(m.id))
    const cached = await ref.get()

    // Skip if already in a terminal state
    const DONE = ['FT', 'AET', 'PEN', 'AWD', 'WO']
    if (cached.exists && DONE.includes(cached.data().status)) { skipped++; continue }

    try {
      const data      = await apiGet(`/fixtures?id=${m.id}`)
      const f         = data.response[0]
      if (!f) continue

      const goals     = (f.events || []).filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
      const firstGoal = goals[0] || null

      const result = {
        matchId:        m.id,
        homeScore:      f.goals.home,
        awayScore:      f.goals.away,
        firstTeamScore: firstGoal?.team.name   || null,
        firstScorer:    firstGoal?.player.name || null,
        firstScorerPos: firstGoal ? posAbbr(firstGoal.player?.position || '') : null,
        status:         f.fixture.status.short,
        updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
      }

      await ref.set(result)
      console.log(`  ✓  Result cached: ${m.home.name} ${result.homeScore}–${result.awayScore} ${m.away.name} [${result.status}]`)
      fetched++
    } catch (e) {
      console.warn(`  ⚠️  Result fetch failed for ${m.id}: ${e.message}`)
      failed++
    }
  }

  console.log(`  Results: ${fetched} fetched, ${skipped} already cached, ${failed} failed`)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function posAbbr(pos) {
  const map = { Goalkeeper: 'GK', Defender: 'CB', Midfielder: 'CM', Attacker: 'ST' }
  return map[pos] || pos || 'ST'
}

function normaliseMatch(f) {
  return {
    id:     f.fixture.id,
    date:   f.fixture.date,
    venue:  f.fixture.venue.name,
    status: f.fixture.status.short,
    round:  f.league.round,
    homeId: f.teams.home.id,
    awayId: f.teams.away.id,
    home: { name: f.teams.home.name, logo: f.teams.home.logo },
    away: { name: f.teams.away.name, logo: f.teams.away.logo },
  }
}

// ── Summary & log ──────────────────────────────────────────────────────────

async function logRun(callsUsed) {
  await db.collection('_cache').doc('fetch_log').set({
    lastRun:    admin.firestore.FieldValue.serverTimestamp(),
    callsUsed,
    remaining:  DAILY_LIMIT - callsUsed,
  }, { merge: true })
}

// ── Time guard (Eastern time quiet window) ─────────────────────────────────

function isQuietWindow() {
  // No games between 3 AM – 9 AM Eastern — skip API calls during this window
  const QUIET_START = 3   // 3:00 AM ET
  const QUIET_END   = 9   // 9:00 AM ET

  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const hour  = new Date(nowET).getHours()

  return hour >= QUIET_START && hour < QUIET_END
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const started = new Date().toISOString()
  console.log(`\n🚀  WC26 Prefetch — ${started}`)
  console.log(`    Budget: ${DAILY_LIMIT} API calls this run\n`)

  // Quiet window check — no games 3 AM–9 AM ET, skip to save API calls
  if (isQuietWindow()) {
    const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: true })
    console.log(`😴  Quiet window active (3 AM–9 AM ET) — current time: ${nowET} ET`)
    console.log('    No games during this window. Skipping all API calls.')
    console.log('    Next run outside this window will pick up any pending data.\n')
    process.exit(0)
  }

  try {
    const matches = await ensureFixtures()
    await fetchPendingSquads(matches)
    await fetchPendingResults(matches)
    await recalcAllLeagues(matches)
  } catch (e) {
    console.error('\n❌  Fatal error:', e.message)
  }

  console.log(`\n✅  Done — used ${callsThisRun}/${DAILY_LIMIT} API calls`)
  await logRun(callsThisRun)
  process.exit(0)
}
async function recalcAllLeagues(matches = []) {
  console.log('\n🏆  Recalculating leaderboards…')
  const matchRound = {}
  matches.forEach(m => { matchRound[m.id] = m.round })

  const leaguesSnap = await db.collection('leagues').get()
  for (const leagueDoc of leaguesSnap.docs) {
    const leagueId = leagueDoc.id
    const [predsSnap, resultsSnap] = await Promise.all([
      db.collection('predictions').where('leagueId', '==', leagueId).get(),
      db.collection('results').get(),
    ])
    const results = {}
    resultsSnap.docs.forEach(d => { results[d.data().matchId] = d.data() })
    const predsByMatch = {}
    predsSnap.docs.forEach(d => {
      const data = d.data()
      if (!predsByMatch[data.matchId]) predsByMatch[data.matchId] = []
      predsByMatch[data.matchId].push(data)
    })
    const totals = {}
    predsSnap.docs.forEach(d => {
      const pred = d.data()
      const leaguePreds = predsByMatch[pred.matchId] || []
      const result = results[pred.matchId]
      if (!result) return
      const round = matchRound[pred.matchId] || null
      const pts = calcPointsAdmin(pred, result, leaguePreds, round)
      if (!totals[pred.uid]) totals[pred.uid] = { uid: pred.uid, total: 0, exact: 0, correct: 0, scorerHits: 0 }
      totals[pred.uid].total += pts
      const exactH = pred.homeScore === result.homeScore
      const exactA = pred.awayScore === result.awayScore
      const pw = Math.sign(pred.homeScore - pred.awayScore)
      const rw = Math.sign(result.homeScore - result.awayScore)
      if (exactH && exactA) totals[pred.uid].exact++
      else if (pw === rw) totals[pred.uid].correct++
      const scorerHit = pred.firstScorer && (pred.firstScorer === 'NO_SCORER' ? result.firstScorer == null : normName(pred.firstScorer) === normName(result.firstScorer))
      if (scorerHit) totals[pred.uid].scorerHits++
    })
    const members = leagueDoc.data()?.members || []
    const memberMap = {}
    members.forEach(m => { memberMap[m.uid] = m.displayName })
    await Promise.all(Object.values(totals).map(entry =>
      db.collection('scores').doc(`${leagueId}_${entry.uid}`).set({
        leagueId, ...entry,
        displayName: memberMap[entry.uid] || 'Unknown',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    ))
    console.log(`  ✓  League ${leagueDoc.data().name} recalculated`)
  }
}

function normName(n) {
  if (!n) return n
  return n.normalize('NFC')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function roundMultiplier(round) {
  if (!round) return 1
  const r = round.toLowerCase()
  return (r.includes('quarter') || r.includes('semi') || r.includes('final') || r.includes('3rd')) ? 2 : 1
}

function calcPointsAdmin(prediction, result, leaguePreds = [], round = null) {
  if (!prediction || !result || result.homeScore == null) return 0
  let pts = 0
  const pw = Math.sign(prediction.homeScore - prediction.awayScore)
  const rw = Math.sign(result.homeScore - result.awayScore)
  if (pw === rw) pts += 4
  if (prediction.homeScore === result.homeScore) pts += 1
  if (prediction.awayScore === result.awayScore) pts += 1
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) pts += 3
  if (prediction.firstTeam) {
    const ftsHit = prediction.firstTeam === 'NO_GOALS' ? result.firstTeamScore == null : prediction.firstTeam === result.firstTeamScore
    if (ftsHit) pts += 2
  }
  const scorerHit = prediction.firstScorer && (prediction.firstScorer === 'NO_SCORER' ? result.firstScorer == null : normName(prediction.firstScorer) === normName(result.firstScorer))
  if (scorerHit) pts += 4
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore && leaguePreds.length > 0) {
    const scorePicks = leaguePreds.filter(p => p.homeScore === prediction.homeScore && p.awayScore === prediction.awayScore).length
    if (scorePicks / leaguePreds.length < 0.05) pts += 2
  }
  if (scorerHit && leaguePreds.length > 0) {
    const scorerPicks = leaguePreds.filter(p => normName(p.firstScorer) === normName(prediction.firstScorer)).length
    if (scorerPicks / leaguePreds.length < 0.05) pts += 2
  }
  return pts * roundMultiplier(round)
}
main()
