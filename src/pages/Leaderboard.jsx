import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeaderboard, subscribeLeague } from '../services/firestore'

const RANK_ICON = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r

export default function Leaderboard() {
  const { leagueId }  = useParams()
  const { user }      = useAuth()
  const [scores,  setScores]  = useState([])
  const [league,  setLeague]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubLb     = subscribeLeaderboard(leagueId, data => { setScores(data); setLoading(false) })
    const unsubLeague = subscribeLeague(leagueId, setLeague)
    return () => { unsubLb(); unsubLeague() }
  }, [leagueId])

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>

  return (
    <div className="page">
      <h1 className="page-title">{league?.name || 'Leaderboard'}</h1>
      <p className="page-sub">Updates live after each result is confirmed.</p>

      <div className="pts-grid">
        <div className="pts-pill"><span className="pts-pill-label">Correct result</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>4 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Exact score</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>9 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Correct goals (per team)</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>+1 pt</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First team to score</span><span className="pts-pill-val" style={{ color: 'var(--amber)' }}>+2 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First scorer (FW)</span><span className="pts-pill-val" style={{ color: 'var(--blue)' }}>+4 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First scorer (MF)</span><span className="pts-pill-val" style={{ color: 'var(--blue)' }}>+5 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First scorer (DEF/GK)</span><span className="pts-pill-val" style={{ color: 'var(--blue)' }}>+6 pts</span></div>
      </div>

      {scores.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
          No scores yet — get predicting! ⚽
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {scores.map((s, i) => {
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
