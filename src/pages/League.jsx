import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLeague } from '../services/firestore'

export default function League() {
  const { leagueId } = useParams()
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [league, setLeague] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribeLeague(leagueId, setLeague), [leagueId])

  if (!league) return <div className="spinner-wrap"><div className="spinner" /></div>

  const isAdmin = league.adminUid === user.uid
  const inviteUrl = `${window.location.origin}?join=${league.code}`

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <h1 className="page-title">{league.name}</h1>
      <p className="page-sub">League settings &amp; invite</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={() => navigate(`/league/${leagueId}/predictions`)}>
          ⚽ Make predictions
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/league/${leagueId}/leaderboard`)}>
          🏆 Leaderboard
        </button>
      </div>

      <div className="section-label">Invite code</div>
      <div className="invite-box" style={{ marginBottom: 24 }}>
        <div>
          <div className="invite-code">{league.code}</div>
          <div className="text-xs dimmer" style={{ marginTop: 2 }}>Share this code or the link below</div>
        </div>
        <button className="btn btn-secondary text-sm" onClick={copyInvite}>
          {copied ? '✓ Copied!' : 'Copy link'}
        </button>
      </div>

      <div className="section-label">Members ({league.members?.length || 0})</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {(league.members || []).map((m) => {
          const initials = m.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'
          const isMe = m.uid === user.uid
          return (
            <div key={m.uid} className="board-row" style={{ padding: '12px 16px' }}>
              <div className="avatar" style={{ background: isMe ? 'var(--green)' : 'var(--blue)', color: 'var(--bg-0)' }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>
                  {m.displayName} {isMe && <span className="badge badge-green">you</span>}
                </div>
              </div>
              {league.adminUid === m.uid && <span className="badge badge-amber">admin</span>}
            </div>
          )
        })}
      </div>

      <div className="divider" />
      <div className="section-label">Scoring rules</div>
      <div className="pts-grid">
        <div className="pts-pill"><span className="pts-pill-label">Correct result</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>4 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Exact score</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>9 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">Correct goals (per team)</span><span className="pts-pill-val" style={{ color: 'var(--green)' }}>+1 pt</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First team to score</span><span className="pts-pill-val" style={{ color: 'var(--amber)' }}>+2 pts</span></div>
        <div className="pts-pill"><span className="pts-pill-label">First goalscorer</span><span className="pts-pill-val" style={{ color: 'var(--blue)' }}>+4 pts</span></div>

      </div>
    </div>
  )
}
