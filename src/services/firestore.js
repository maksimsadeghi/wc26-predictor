import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Leagues ────────────────────────────────────────────────────────────────

export async function createLeague(uid, displayName, leagueName) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  const ref  = doc(collection(db, 'leagues'))
  await setDoc(ref, {
    id: ref.id, name: leagueName, code, adminUid: uid,
    members: [{ uid, displayName, joinedAt: Date.now() }],
    createdAt: serverTimestamp(),
  })

  //Set Score to 0 when Creating league
  await setDoc(doc(db, 'scores', `${ref.id}_${uid}`), {
  leagueId: ref.id,
  uid,
  displayName,
  total: 0,
  exact: 0,
  correct: 0,
  scorerHits: 0,
  updatedAt: serverTimestamp(),
})

  return { id: ref.id, code }
}

export async function joinLeague(uid, displayName, code) {
  const q    = query(collection(db, 'leagues'), where('code', '==', code.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('League not found')
  const leagueDoc = snap.docs[0]
  const data = leagueDoc.data()
  if (data.members.some(m => m.uid === uid)) return leagueDoc.id
  await updateDoc(leagueDoc.ref, {
    members: [...data.members, { uid, displayName, joinedAt: Date.now() }],
  })
    //Set Join league to 0
    await setDoc(doc(db, 'scores', `${leagueDoc.id}_${uid}`), {
    leagueId: leagueDoc.id,
    uid,
    displayName,
    total: 0,
    exact: 0,
    correct: 0,
    scorerHits: 0,
    updatedAt: serverTimestamp(),
  })

  return leagueDoc.id
}

export async function getLeague(leagueId) {
  const snap = await getDoc(doc(db, 'leagues', leagueId))
  return snap.exists() ? snap.data() : null
}

export function subscribeLeague(leagueId, cb) {
  return onSnapshot(doc(db, 'leagues', leagueId), snap => cb(snap.data()))
}

// ── Predictions ────────────────────────────────────────────────────────────

function predId(leagueId, matchId, uid) {
  return `${leagueId}_${matchId}_${uid}`
}

export async function savePrediction(leagueId, matchId, uid, prediction) {
  const ref = doc(db, 'predictions', predId(leagueId, matchId, uid))
  await setDoc(ref, {
    leagueId, matchId, uid,
    ...prediction, // { homeScore, awayScore, firstTeam?, firstScorer?, firstScorerPos? }
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function subscribeMyPredictions(leagueId, uid, cb) {
  const q = query(
    collection(db, 'predictions'),
    where('leagueId', '==', leagueId),
    where('uid', '==', uid),
  )
  return onSnapshot(q, snap => {
    const map = {}
    snap.docs.forEach(d => { map[d.data().matchId] = d.data() })
    cb(map)
  })
}

// ── Results (written via Firebase Console or admin script) ─────────────────

export async function saveResult(matchId, result) {
  await setDoc(doc(db, 'results', String(matchId)), {
    matchId,
    ...result, // { homeScore, awayScore, firstTeamScore, firstScorer, firstScorerPos }
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function subscribeFixtures(cb) {
  return onSnapshot(doc(db, '_cache', 'fixtures_13_2026'), snap => {
    cb(snap.exists() ? (snap.data().matches || []) : [])
  })
}

export function subscribeResults(cb) {
  return onSnapshot(collection(db, 'results'), snap => {
    const map = {}
    snap.docs.forEach(d => { map[d.data().matchId] = d.data() })
    cb(map)
  })
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export function subscribeLeaderboard(leagueId, cb) {
  const q = query(
    collection(db, 'scores'),
    where('leagueId', '==', leagueId),
    orderBy('total', 'desc'),
  )
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())))
}

// ── Scoring engine ─────────────────────────────────────────────────────────

function normName(n) {
  if (!n) return n
  return n.normalize('NFC')
    .replace(/[​‌‍﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Points for a correct first goalscorer
function scorerPts() {
  return 4
}

export function calcPoints(prediction, result, leaguePreds = []) {
  if (!prediction || !result || result.homeScore == null) return 0
  let pts = 0
  const pw = Math.sign(prediction.homeScore - prediction.awayScore)
  const rw = Math.sign(result.homeScore     - result.awayScore)

  if (pw === rw) pts += 4                                          // correct result (win/draw/loss)
  if (prediction.homeScore === result.homeScore) pts += 1          // correct home goal count
  if (prediction.awayScore === result.awayScore) pts += 1          // correct away goal count
  if (prediction.homeScore === result.homeScore &&
      prediction.awayScore === result.awayScore) pts += 3          // exact score bonus

  if (prediction.firstTeam) {
    const ftsHit = prediction.firstTeam === 'NO_GOALS'
      ? result.firstTeamScore == null
      : prediction.firstTeam === result.firstTeamScore
    if (ftsHit) pts += 2
  }

  if (prediction.firstScorer) {
    const scorerHit = prediction.firstScorer === 'NO_SCORER'
      ? result.firstScorer == null
      : normName(prediction.firstScorer) === normName(result.firstScorer)
    if (scorerHit) pts += scorerPts(result.firstScorerPos)
  }

  // Underdog bonus — scoreline
  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    const total = leaguePreds.length
    const scorePicks = leaguePreds.filter(p => p.homeScore === prediction.homeScore && p.awayScore === prediction.awayScore).length
    if (total > 0 && scorePicks / total < 0.05) pts += 2
  }

  // Underdog bonus — first scorer
  {
    const underdogScorerHit = prediction.firstScorer && (prediction.firstScorer === 'NO_SCORER'
      ? result.firstScorer == null
      : normName(prediction.firstScorer) === normName(result.firstScorer))
    if (underdogScorerHit) {
      const total = leaguePreds.length
      const scorerPicks = leaguePreds.filter(p => normName(p.firstScorer) === normName(prediction.firstScorer)).length
      if (total > 0 && scorerPicks / total < 0.05) pts += 2
    }
  }

  return pts
}

// Breakdown for showing on the UI (how many points came from each component)
export function pointsBreakdown(prediction, result, leaguePreds = []) {
  if (!prediction || !result || result.homeScore == null)
    return { result: 0, homeGoal: 0, awayGoal: 0, exactBonus: 0, firstTeam: 0, firstScorer: 0, total: 0 }

  const pw = Math.sign(prediction.homeScore - prediction.awayScore)
  const rw = Math.sign(result.homeScore     - result.awayScore)
  const exactH = prediction.homeScore === result.homeScore
  const exactA = prediction.awayScore === result.awayScore

  const ftsHit = prediction.firstTeam && (prediction.firstTeam === 'NO_GOALS'
    ? result.firstTeamScore == null
    : prediction.firstTeam === result.firstTeamScore)
  const scorerHit = prediction.firstScorer && (prediction.firstScorer === 'NO_SCORER'
    ? result.firstScorer == null
    : normName(prediction.firstScorer) === normName(result.firstScorer))

  const breakdown = {
    result:      pw === rw ? 4 : 0,
    homeGoal:    exactH ? 1 : 0,
    awayGoal:    exactA ? 1 : 0,
    exactBonus:  exactH && exactA ? 3 : 0,
    firstTeam:   ftsHit ? 2 : 0,
    firstScorer: scorerHit ? scorerPts(result.firstScorerPos) : 0,
    underdogScore:  0,
    underdogScorer: 0,
  }

  // Underdog bonus — scoreline
  if (exactH && exactA && leaguePreds.length > 0) {
    const scorePicks = leaguePreds.filter(p => p.homeScore === prediction.homeScore && p.awayScore === prediction.awayScore).length
    if (scorePicks / leaguePreds.length < 0.05) breakdown.underdogScore = 2
  }

  // Underdog bonus — first scorer
  if (scorerHit && leaguePreds.length > 0) {
    const scorerPicks = leaguePreds.filter(p => normName(p.firstScorer) === normName(prediction.firstScorer)).length
    if (scorerPicks / leaguePreds.length < 0.05) breakdown.underdogScorer = 2
  }

  breakdown.total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return breakdown
}

export async function recalcLeaderboard(leagueId) {
  const [predsSnap, resultsSnap, leagueSnap] = await Promise.all([
    getDocs(query(collection(db, 'predictions'), where('leagueId', '==', leagueId))),
    getDocs(collection(db, 'results')),
    getDoc(doc(db, 'leagues', leagueId)),
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
    const pts  = calcPoints(pred, results[pred.matchId], predsByMatch[pred.matchId] || [])
    if (!totals[pred.uid]) totals[pred.uid] = { uid: pred.uid, total: 0, exact: 0, correct: 0, scorerHits: 0 }
    totals[pred.uid].total += pts
    const bd = pointsBreakdown(pred, results[pred.matchId], predsByMatch[pred.matchId] || [])
    if (bd.exactBonus > 0)     totals[pred.uid].exact++
    else if (bd.result > 0)    totals[pred.uid].correct++
    if (bd.firstScorer > 0)    totals[pred.uid].scorerHits++
  })

  const members = leagueSnap.data()?.members || []
  const memberMap = {}
  members.forEach(m => { memberMap[m.uid] = m.displayName })

  await Promise.all(Object.values(totals).map(entry =>
    setDoc(doc(db, 'scores', `${leagueId}_${entry.uid}`), {
      leagueId, ...entry,
      displayName: memberMap[entry.uid] || 'Unknown',
      updatedAt: serverTimestamp(),
    }, { merge: true })
  ))
}

//My Leagues
export function subscribeMyLeagues(uid, cb) {
  return onSnapshot(collection(db, 'leagues'), snap => {
    const mine = snap.docs
      .map(d => d.data())
      .filter(league => league.members?.some(m => m.uid === uid))
    cb(mine)
  })
}

export function subscribeAllPredictions(leagueId, cb) {
  const q = query(
    collection(db, 'predictions'),
    where('leagueId', '==', leagueId),
  )
  return onSnapshot(q, snap => {
    const map = {}
    snap.docs.forEach(d => {
      const data = d.data()
      if (!map[data.matchId]) map[data.matchId] = []
      map[data.matchId].push(data)
    })
    cb(map)
  })
}
