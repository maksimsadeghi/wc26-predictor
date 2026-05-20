// API-Football v3 — https://www.api-football.com/documentation-v3
// World Cup 2026 league ID: 1 (FIFA World Cup), season: 2026
//
// ── Caching strategy ──────────────────────────────────────────────────────────
// Every API response is written to Firestore on first fetch.
// Subsequent calls read from Firestore, never hitting the API again.
// This keeps daily usage well under the 100 req/day free-tier limit:
//   • Fixtures:  1 API call ever (re-fetch only if admin triggers manually)
//   • Squads:    1 API call per team ever (48 total, spread over first session)
//   • Results:   1 API call per finished match ever (104 total over the tournament)

import { db } from '../firebase'
import {
  doc, getDoc, setDoc, collection, getDocs, serverTimestamp,
} from 'firebase/firestore'

const BASE = 'https://v3.football.api-sports.io'
const KEY  = import.meta.env.VITE_API_FOOTBALL_KEY

const headers = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key':  KEY,
}

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`)
  return res.json()
}

// ── Fixtures ───────────────────────────────────────────────────────────────

export async function fetchMatches() {
  // 1. Check Firestore cache
  const cacheRef = doc(db, '_cache', 'fixtures_2026')
  const cached   = await getDoc(cacheRef)
  if (cached.exists()) return cached.data().matches

  // 2. First time only — hit the API and store
  console.log('[API-Football] Fetching fixtures (1 request)')
  const data    = await apiFetch('/fixtures?league=1&season=2026')
  const matches = data.response.map(normaliseMatch)
  await setDoc(cacheRef, { matches, fetchedAt: serverTimestamp() })
  return matches
}

// Force a refresh (admin use only — costs 1 API call)
export async function refreshFixtures() {
  console.log('[API-Football] Force-refreshing fixtures')
  const data    = await apiFetch('/fixtures?league=1&season=2026')
  const matches = data.response.map(normaliseMatch)
  await setDoc(doc(db, '_cache', 'fixtures_2026'), { matches, fetchedAt: serverTimestamp() })
  return matches
}

// ── Results ────────────────────────────────────────────────────────────────

export async function fetchMatchResult(fixtureId) {
  // 1. Check Firestore cache — once a result is FT we never re-fetch
  const cacheRef = doc(db, 'results', String(fixtureId))
  const cached   = await getDoc(cacheRef)
  if (cached.exists() && cached.data().status === 'FT') return cached.data()

  // 2. Hit the API
  console.log(`[API-Football] Fetching result for fixture ${fixtureId}`)
  const data = await apiFetch(`/fixtures?id=${fixtureId}`)
  const f    = data.response[0]
  if (!f) return null

  const goals     = (f.events || []).filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
  const firstGoal = goals[0] || null

  // Map position to our abbreviation for scorer bonus
  const scorerPos = firstGoal
    ? posAbbr(firstGoal.player.position || '')
    : null

  const result = {
    matchId:        fixtureId,
    homeScore:      f.goals.home,
    awayScore:      f.goals.away,
    firstTeamScore: firstGoal ? firstGoal.team.name   : null,
    firstScorer:    firstGoal ? firstGoal.player.name : null,
    firstScorerPos: scorerPos,
    status:         f.fixture.status.short,
    updatedAt:      serverTimestamp(),
  }

  // Only permanently cache finished matches
  if (result.status === 'FT') {
    await setDoc(cacheRef, result)
  }

  return result
}

// ── Squads ─────────────────────────────────────────────────────────────────

export async function fetchSquad(teamId) {
  // 1. Check Firestore cache
  const cacheRef = doc(db, '_cache', `squad_${teamId}`)
  const cached   = await getDoc(cacheRef)
  if (cached.exists()) return cached.data().players

  // 2. Hit the API (1 call per team, 48 teams max over the tournament)
  console.log(`[API-Football] Fetching squad for team ${teamId}`)
  const data  = await apiFetch(`/players/squads?team=${teamId}`)
  const squad = data.response[0]?.players || []
  const players = squad.map(p => ({
    id:  p.id,
    name: p.name,
    pos:  posAbbr(p.position),
  }))

  await setDoc(cacheRef, { players, fetchedAt: serverTimestamp() })
  return players
}

// ── Helpers ────────────────────────────────────────────────────────────────

function posAbbr(pos) {
  const map = {
    Goalkeeper: 'GK',
    Defender:   'CB',
    Midfielder: 'CM',
    Attacker:   'ST',
  }
  return map[pos] || pos
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
