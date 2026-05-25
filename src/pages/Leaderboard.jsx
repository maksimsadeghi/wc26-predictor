import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeaderboard, subscribeLeague, calcPoints, pointsBreakdown } from '../services/firestore'
import { db } from '../firebase'
import { fetchMatches } from '../services/apiFootball'
import { collection, getDocs, query, where } from 'firebase/firestore'

const RANK_ICON = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r

export default function Leaderboard() {
  const navigate = useNavigate()
  const { leagueId }  = useParams()
  const { user }      = useAuth()
  const [scores,  setScores]  = useState([])
  const [league,  setLeague]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter,      setFilter]      = useState('total')
  const [rounds,      setRounds]      = useState([])
  const [roundScores, setRoundScores] = useState([])
  const [calculating, setCalculating] = useState(false) 

  useEffect(() => {
    const unsubLb     = subscribeLeaderboard(leagueId, data => { setScores(data); setLoading(false) })
    const unsubLeague = subscribeLeague(leagueId, setLeague)
    return () => { unsubLb(); unsubLeague() }
  }, [leagueId])

  // Load rounds dynamically from matches
useEffect(() => {
  fetchMatches().then(matches => {
    const unique = [...new Set(matches.map(m => m.round))].sort()
    setRounds(unique)
  })
}, [])

// When a round is selected, calculate points for that round
useEffect(() => {
  if (filter === 'total') return
    async function calcRound() {
      setCalculating(true)
      const [predsSnap, resultsSnap, matchesData] = await Promise.all([
        getDocs(query(collection(db, 'predictions'), where('leagueId', '==', leagueId))),
        getDocs(collection(db, 'results')),
        fetchMatches(),
      ])
      const roundMatchIds = new Set(
        matchesData.filter(m => m.round === filter).map(m => m.id)
      )
      
      const results = {}
      resultsSnap.docs.forEach(d => { results[d.data().matchId] = d.data() })
      const totals = {}
      predsSnap.docs.forEach(d => {
        const pred = d.data()
        if (!roundMatchIds.has(pred.matchId)) return
        const pts = calcPoints(pred, results[pred.matchId])
        if (!totals[pred.uid]) totals[pred.uid] = { uid: pred.uid, total: 0, exact: 0, correct: 0, scorerHits: 0 }
        totals[pred.uid].total += pts
        const bd = pointsBreakdown(pred, results[pred.matchId])
        if (bd.exactBonus > 0)  totals[pred.uid].exact++
        else if (bd.result > 0) totals[pred.uid].correct++
        if (bd.firstScorer > 0) totals[pred.uid].scorerHits++
      })
      const members = league?.members || []
      members.forEach(m => {
        if (!totals[m.uid]) totals[m.uid] = { uid: m.uid, total: 0, exact: 0, correct: 0, scorerHits: 0 }
        totals[m.uid].displayName = m.displayName
      })
      setRoundScores(Object.values(totals).sort((a, b) => b.total - a.total))
      setCalculating(false)
    }
    calcRound()
  }, [filter, leagueId, league])

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>

  const displayScores = filter === 'total' ? scores : roundScores
  return (
    //Leaderboard Button
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
  <h1 className="page-title" style={{ marginBottom: 0 }}>{league?.name || 'Leaderboard'}</h1>
  <button
    className="btn btn-ghost text-sm"
    onClick={() => navigate(`/league/${leagueId}/predictions`)}
  >
    ⚽ Predictions
  </button>
</div>
      <p className="page-sub">Updates live after each result is confirmed.</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
  <button
    className={`btn ${filter === 'total' ? 'btn-primary' : 'btn-ghost'} text-sm`}
    style={{ padding: '6px 14px' }}
    onClick={() => setFilter('total')}
  >
    🏆 Total
  </button>
  <div style={{ width: '100%', height: '0.5px', background: 'var(--border)', margin: '4px 0' }} />
  {rounds.map(round => (
    <button
      key={round}
      className={`btn ${filter === round ? 'btn-primary' : 'btn-ghost'} text-sm`}
      style={{ padding: '6px 14px' }}
      onClick={() => setFilter(round)}
    >
      {round}
    </button>
  ))}
</div>
{calculating && <div className="spinner-wrap" style={{ minHeight: 80 }}><div className="spinner" /></div>}
      <div className="pts-grid">
        <div className="pts-pill"><span className="pts-pill-label">Correct result</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>4 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Exact score</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>9 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Correct goals (per team)</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>+1 pt</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First team to score</span><span className="pts-pill-val" style={{ color: 'var(--amber)' }}>+2 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First goalscorer</span><span className="pts-pill-val" style={{ color: 'var(--blue)' }}>+4 pts</span></div>

      </div>

      {displayScores.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
          No scores yet — get predicting! ⚽
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {displayScores.map((s, i) => {
          const rank     = i + 1
          const isMe     = s.uid === user.uid
          const initials = s.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
          return (
            <div key={s.uid} className={`board-row ${isMe ? 'me-row' : ''}`}>
              <div className="board-rank">{RANK_ICON(rank)}</div>
              <div className="avatar" style={{ background: isMe ? 'var(--green)' : 'var(--blue)', color: 'var(--bg-0)', fontSize: 11 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>
                  {s.displayName}
                  {isMe && <span className="badge badge-green" style={{ marginLeft: 6 }}>you</span>}
                </div>
                <div className="text-xs dimmer" style={{ marginTop: 2 }}>
                  {s.exact || 0} exact &nbsp;·&nbsp; {s.correct || 0} correct &nbsp;·&nbsp; {s.scorerHits || 0} scorer hits
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="board-pts">{s.total || 0} pts</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
