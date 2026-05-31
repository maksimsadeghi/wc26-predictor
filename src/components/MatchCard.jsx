import { useState, useCallback, useEffect } from 'react'
import { savePrediction, pointsBreakdown } from '../services/firestore'

const DEBOUNCE_MS = 800

function scorerPts() {
  return 4
}

export default function MatchCard({ match, leagueId, uid, displayName, myPrediction, allPredictions, result, squads, members = {} }) {
  const [homeScore,    setHomeScore]    = useState(myPrediction?.homeScore    ?? 0)
  const [awayScore,    setAwayScore]    = useState(myPrediction?.awayScore    ?? 0)
  const [firstTeam,    setFirstTeam]    = useState(myPrediction?.firstTeam    || null)
  const [firstScorer,  setFirstScorer]  = useState(myPrediction?.firstScorer  || null)
  const [scorerPos,    setScorerPos]    = useState(myPrediction?.firstScorerPos || null)
  const [openPanel,    setOpenPanel]    = useState(null)
  const [saving,       setSaving]       = useState(false)

  const DONE_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO']
  const msSinceKickoff = Date.now() - new Date(match.date).getTime()
  const isPast = (result && DONE_STATUSES.includes(result.status)) || DONE_STATUSES.includes(match.status) || msSinceKickoff >= 3 * 60 * 60 * 1000
  const isLocked = isPast || (new Date(match.date) - Date.now() < 30 * 60 * 1000)
  const isLiveBadge = !isPast && msSinceKickoff > 0 && msSinceKickoff < 3 * 60 * 60 * 1000
  const [lockState, setLockState] = useState(isLocked)

  useEffect(() => {
    const interval = setInterval(() => {
      setLockState(isPast || (new Date(match.date) - Date.now() < 30 * 60 * 1000))
    }, 60000)
    return () => clearInterval(interval)
  }, [match.date, isPast])

  const persist = useCallback(
    debounce(async (pred) => {
      setSaving(true)
      await savePrediction(leagueId, match.id, uid, { ...pred, displayName })
      setSaving(false)
    }, DEBOUNCE_MS),
    [leagueId, match.id, uid, displayName]
  )

  // Auto-save 0-0 default so it counts as a submitted prediction
  useEffect(() => {
    if (!myPrediction && !isLocked) {
      savePrediction(leagueId, match.id, uid, {
        homeScore: 0, awayScore: 0, firstTeam: null, firstScorer: null, firstScorerPos: null, displayName,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeScore(side, delta) {
    if (lockState) return
    const next = side === 'home'
      ? Math.max(0, homeScore + delta)
      : Math.max(0, awayScore + delta)
    if (side === 'home') setHomeScore(next)
    else                 setAwayScore(next)
    persist({ homeScore: side === 'home' ? next : homeScore, awayScore: side === 'away' ? next : awayScore, firstTeam, firstScorer, firstScorerPos: scorerPos })
  }

  function pickFTS(team) {
    const next = team === firstTeam ? null : team
    setFirstTeam(next)
    setOpenPanel(null)
    persist({ homeScore, awayScore, firstTeam: next, firstScorer, firstScorerPos: scorerPos })
  }

  function pickScorer(player, pos) {
    const next = player === firstScorer ? null : player
    const nextPos = next ? pos : null
    setFirstScorer(next)
    setScorerPos(nextPos)
    setOpenPanel(null)
    persist({ homeScore, awayScore, firstTeam, firstScorer: next, firstScorerPos: nextPos })
  }

  const homePlayers = squads?.[match.homeId] || []
  const awayPlayers = squads?.[match.awayId] || []
  const matchDate   = new Date(match.date)
  const timeStr     = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const bd = isPast && myPrediction ? pointsBreakdown(
    { homeScore, awayScore, firstTeam, firstScorer },
    result,
    allPredictions || []
  ) : null

  return (
    <div className="card" style={{ position: 'relative' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {match.round} &nbsp;·&nbsp; {timeStr} &nbsp;·&nbsp; {match.venue}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>saving…</span>}
          {isPast && bd && (
            <span style={{
              fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 600, padding: '2px 10px',
              borderRadius: 20, background: bd.total > 0 ? 'var(--green-dim)' : 'rgba(255,255,255,.06)',
              color: bd.total > 0 ? 'var(--green)' : 'var(--text-3)',
            }}>
              {bd.total > 0 ? `+${bd.total}` : '0'} pts
            </span>
          )}
          {isLiveBadge && <span className="badge badge-amber">🔴 LIVE</span>}
          {isPast && <span className="badge badge-gray">FINAL</span>}
        </div>
      </div>

      {/* Teams + score picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <TeamSide team={match.home} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button className="score-btn" onClick={() => changeScore('home', -1)} disabled={lockState}>−</button>
          <div className="score-val" style={isPast && result ? { color: 'var(--green)' } : {}}>
            {isPast && result ? result.homeScore : homeScore}
          </div>
          <button className="score-btn" onClick={() => changeScore('home', 1)} disabled={lockState}>+</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>vs</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button className="score-btn" onClick={() => changeScore('away', -1)} disabled={lockState}>−</button>
          <div className="score-val" style={isPast && result ? { color: 'var(--green)' } : {}}>
            {isPast && result ? result.awayScore : awayScore}
          </div>
          <button className="score-btn" onClick={() => changeScore('away', 1)} disabled={lockState}>+</button>
        </div>
        <TeamSide team={match.away} right />
      </div>

      {/* ── Pre-kickoff: bonus pickers ── */}
      {!lockState && (
        <div style={{ marginTop: 10, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`bonus-trigger ${firstTeam ? 'amber-pick' : ''}`}
              onClick={() => setOpenPanel(p => p === 'fts' ? null : 'fts')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⚡</span><span>First to score</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {firstTeam && <span style={{ fontSize: 11, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstTeam === 'NO_GOALS' ? 'No goals' : firstTeam}</span>}
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: openPanel === 'fts' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
              </span>
            </button>

            <button
              className={`bonus-trigger ${firstScorer ? 'blue-pick' : ''}`}
              onClick={() => setOpenPanel(p => p === 'scorer' ? null : 'scorer')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>👕</span><span>First goalscorer</span>
          
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {firstScorer && <span style={{ fontSize: 11, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstScorer === 'NO_SCORER' ? 'No scorer' : firstScorer}</span>}
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: openPanel === 'scorer' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
              </span>
            </button>
          </div>

          {openPanel === 'fts' && (
            <div className="drop-panel">
              <div className="drop-header">Which team scores first?</div>
              <div className="fts-grid">
                {[match.home, match.away].map(team => (
                  <button key={team.name} className={`fts-opt ${firstTeam === team.name ? 'selected' : ''}`} onClick={() => pickFTS(team.name)}>
                    {team.logo
                      ? <img src={team.logo} alt={team.name} className="fts-flag" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                      : <span className="fts-flag">🏳️</span>}
                    <span className="fts-name">{team.name}</span>
                    <span className="fts-tick">{firstTeam === team.name ? '✓ Selected' : ''}</span>
                  </button>
                ))}
                <button className={`fts-opt ${firstTeam === 'NO_GOALS' ? 'selected' : ''}`} onClick={() => pickFTS('NO_GOALS')} style={{ gridColumn: '1 / -1' }}>
                  <span className="fts-flag" style={{ fontSize: 28 }}>🚫</span>
                  <span className="fts-name">No goals</span>
                  <span className="fts-tick">{firstTeam === 'NO_GOALS' ? '✓ Selected' : ''}</span>
                </button>
              </div>
              <button className="drop-clear" onClick={() => pickFTS(null)}>✕ &nbsp;Clear pick</button>
            </div>
          )}

          {openPanel === 'scorer' && (
            <div className="drop-panel">
              <div className="drop-header">Who scores first? · Position earns bonus pts</div>
              <div className="player-grid" style={{ borderBottom: '0.5px solid var(--border)', marginBottom: 4 }}>
                <button className={`player-row ${firstScorer === 'NO_SCORER' ? 'selected' : ''}`} onClick={() => pickScorer('NO_SCORER', null)}>
                  <span className="player-pos">—</span>
                  <span className="player-name">No first scorer</span>
                  <span className="player-tick">{firstScorer === 'NO_SCORER' ? '✓' : ''}</span>
                </button>
              </div>
              {[{ team: match.home, players: homePlayers }, { team: match.away, players: awayPlayers }].map(({ team, players }, ti) => (
                <div key={team.name}>
                  {ti > 0 && <div className="team-divider" />}
                  <div className="player-team-header">
                    {team.logo && <img src={team.logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
                    <span>{team.name}</span>
                  </div>
                  <div className="player-grid">
                    {players.length > 0
                      ? players.map(p => {
                          return (
                            <button key={p.id} className={`player-row ${firstScorer === p.name ? 'selected' : ''}`} onClick={() => pickScorer(p.name, p.pos)}>
                              <span className="player-pos">{p.pos}</span>
                              <span className="player-name">{p.name}</span>
                              <span className="player-tick">{firstScorer === p.name ? '✓' : ''}</span>
                            </button>
                          )
                        })
                      : <span style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 12px' }}>Loading squad…</span>
                    }
                  </div>
                </div>
              ))}
              <button className="drop-clear" onClick={() => pickScorer(null, null)}>✕ &nbsp;Clear pick</button>
            </div>
          )}
        </div>
      )}

      {/* ── Post-kickoff: everyone's picks + comparison ── */}
      {lockState && (
        <div style={{ marginTop: 10, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>

          {/* Everyone's picks trigger */}
          <button
            className="bonus-trigger"
            style={{ width: '100%', marginBottom: openPanel === 'everyone' ? 5 : 0 }}
            onClick={() => setOpenPanel(p => p === 'everyone' ? null : 'everyone')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>👥</span>
              <span>Everyone's picks</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'rgba(255,255,255,.07)', color: 'var(--text-2)' }}>
                {(allPredictions || []).length} submitted
              </span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: openPanel === 'everyone' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
          </button>

          {openPanel === 'everyone' && (
            <div className="drop-panel" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <div className="drop-header">All predictions{isPast ? ' · colored by accuracy' : ' · results pending'}</div>
              {(allPredictions || []).length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)' }}>No predictions submitted yet</div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: 8, padding: '6px 12px', fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)' }}>
                    <span>Player</span><span style={{ textAlign: 'center' }}>Score</span><span>1st team</span><span>1st scorer</span>
                  </div>
                  {(allPredictions || []).map(pred => {
                    const isMe      = pred.uid === uid
                    const predBd    = isPast ? pointsBreakdown(pred, result) : null
                    const name      = members[pred.uid] || pred.displayName || 'Unknown'
                    const initials  = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    const scoreColor = predBd
                      ? (predBd.exactBonus > 0 ? 'var(--green)' : predBd.result > 0 ? 'var(--amber)' : 'var(--text-3)')
                      : 'var(--text-1)'
                    const ftsOk    = isPast && result && (pred.firstTeam === 'NO_GOALS' ? result.firstTeamScore == null : pred.firstTeam === result.firstTeamScore)
                    const scorerOk = isPast && result && (pred.firstScorer === 'NO_SCORER' ? result.firstScorer == null : pred.firstScorer === result.firstScorer)
                    return (
                      <div key={pred.uid} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', gap: 8, padding: '8px 12px', borderBottom: '0.5px solid var(--border)', background: isMe ? 'var(--green-dim)' : 'transparent', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: isMe ? 'var(--green)' : 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: isMe ? 'var(--bg-0)' : 'var(--text-2)', flexShrink: 0 }}>{initials}</div>
                          <span style={{ fontSize: 12, color: isMe ? 'var(--green)' : 'var(--text-1)', fontWeight: isMe ? 500 : 400 }}>{name}{isMe ? ' (you)' : ''}</span>
                          {predBd && predBd.total > 0 && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: 'var(--green-dim)', color: 'var(--green)', fontWeight: 500 }}>+{predBd.total}</span>}
                        </div>
                        <div style={{ textAlign: 'center', fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 600, color: scoreColor }}>{pred.homeScore ?? '?'}–{pred.awayScore ?? '?'}</div>
                        <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ftsOk ? 'var(--amber)' : 'var(--text-2)' }}>{pred.firstTeam ? `⚡ ${pred.firstTeam === 'NO_GOALS' ? 'No goals' : pred.firstTeam}` : '—'}</div>
                        <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: scorerOk ? 'var(--blue)' : 'var(--text-2)' }}>{pred.firstScorer ? `👕 ${pred.firstScorer === 'NO_SCORER' ? 'No scorer' : pred.firstScorer}` : '—'}</div>
                      </div>
                    )
                  })}
                  {isPast && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)' }}>Green = exact · Amber = correct result · Gray = wrong</div>}
                </div>
              )}
            </div>
          )}

          {/* Post-result comparison */}
          {isPast && result && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Your prediction</div>
                  {myPrediction ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, color: bd?.exactBonus > 0 ? 'var(--green)' : bd?.result > 0 ? 'var(--amber)' : 'var(--text-3)' }}>
                        {homeScore} – {awayScore}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                        {firstTeam ? `⚡ ${firstTeam === 'NO_GOALS' ? 'No goals' : firstTeam}` : '⚡ no pick'}<br />
                        {firstScorer ? `👕 ${firstScorer === 'NO_SCORER' ? 'No scorer' : `${firstScorer} (${scorerPos})`}` : '👕 no pick'}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>No prediction submitted</div>
                  )}
                </div>
                <div style={{ background: 'rgba(74,222,128,.05)', border: '.5px solid rgba(74,222,128,.15)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 5 }}>Actual result</div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                    {result.homeScore} – {result.awayScore}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 3 }}>
                    ⚡ {result.firstTeamScore || '—'}<br />
                    👕 {result.firstScorer || '—'}
                  </div>
                </div>
              </div>
              {bd && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {bd.result      > 0 && <Tag color="green">+{bd.result} result</Tag>}
                  {bd.homeGoal    > 0 && <Tag color="green">+1 {match.home.name.split(' ')[0]} goals</Tag>}
                  {bd.awayGoal    > 0 && <Tag color="green">+1 {match.away.name.split(' ')[0]} goals</Tag>}
                  {bd.exactBonus  > 0 && <Tag color="green">+3 exact bonus</Tag>}
                  {bd.firstTeam   > 0 && <Tag color="amber">+2 first team</Tag>}
                  {bd.firstScorer > 0 && <Tag color="blue">+{bd.firstScorer} scorer ({result.firstScorerPos})</Tag>}
                  {bd.total === 0     && <Tag color="gray">no points this match</Tag>}
                  {bd.underdogScore  > 0 && <Tag color="amber">+{bd.underdogScore} underdog score 🐉</Tag>}
                  {bd.underdogScorer > 0 && <Tag color="amber">+{bd.underdogScorer} underdog scorer 🐉</Tag>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Tag({ color, children }) {
  const styles = {
    green:  { background: 'var(--green-dim)',  color: 'var(--green)'  },
    amber:  { background: 'var(--amber-dim)',  color: 'var(--amber)'  },
    blue:   { background: 'var(--blue-dim)',   color: 'var(--blue)'   },
    purple: { background: 'var(--purple-dim)', color: 'var(--purple)' },
    gray:   { background: 'rgba(255,255,255,.06)', color: 'var(--text-3)' },
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, ...styles[color] }}>
      {children}
    </span>
  )
}

function TeamSide({ team, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexDirection: right ? 'row-reverse' : 'row', minWidth: 0 }}>
      {team.logo
        ? <img src={team.logo} alt={team.name} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
        : <span style={{ fontSize: 22, flexShrink: 0 }}>🏳️</span>}
      <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: right ? 'right' : 'left' }}>
        {team.name}
      </span>
    </div>
  )
}

function debounce(fn, delay) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay) }
}
