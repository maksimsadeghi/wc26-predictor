import { useState, useCallback, useEffect } from 'react'
import { savePrediction, pointsBreakdown } from '../services/firestore'

const DEBOUNCE_MS = 800

function scorerPts(pos) {
  if (!pos) return 4
  if (['GK', 'CB', 'RB', 'LB', 'DF'].includes(pos)) return 6
  if (['CM', 'AM', 'MF'].includes(pos))              return 5
  return 4
}

export default function MatchCard({ match, leagueId, uid, myPrediction, result, squads }) {
  const [homeScore,    setHomeScore]    = useState(myPrediction?.homeScore    ?? 0)
  const [awayScore,    setAwayScore]    = useState(myPrediction?.awayScore    ?? 0)
  const [firstTeam,    setFirstTeam]    = useState(myPrediction?.firstTeam    || null)
  const [firstScorer,  setFirstScorer]  = useState(myPrediction?.firstScorer  || null)
  const [scorerPos,    setScorerPos]    = useState(myPrediction?.firstScorerPos || null)
  const [openPanel,    setOpenPanel]    = useState(null)
  const [saving,       setSaving]       = useState(false)

  const isPast = result && result.status === 'FT'
  const isLocked = isPast || (new Date(match.date) - Date.now() < 30 * 60 * 1000) // Set to lock 30 minutes before start
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
      await savePrediction(leagueId, match.id, uid, pred)
      setSaving(false)
    }, DEBOUNCE_MS),
    [leagueId, match.id, uid]
  )

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

  // Points breakdown when result is available
  const bd = isPast ? pointsBreakdown(
    { homeScore, awayScore, firstTeam, firstScorer },
    result
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
          {isPast && <span className="badge badge-gray">FINAL</span>}
        </div>
      </div>

      {/* Teams + score picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <TeamSide team={match.home} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button className="score-btn" onClick={() => changeScore('home', -1)}  disabled={lockState}>−</button>
          <div className="score-val" style={isPast && result ? { color: 'var(--green)' } : {}}>
            {isPast && result ? result.homeScore : homeScore}
          </div>
          <button className="score-btn" onClick={() => changeScore('home', 1)}  disabled={lockState}>+</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>vs</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button className="score-btn" onClick={() => changeScore('away', -1)}  disabled={lockState}>−</button>
          <div className="score-val" style={isPast && result ? { color: 'var(--green)' } : {}}>
            {isPast && result ? result.awayScore : awayScore}
          </div>
          <button className="score-btn" onClick={() => changeScore('away', 1)}  disabled={lockState}>+</button>
        </div>
        <TeamSide team={match.away} right />
      </div>

      {/* ── Pre-result: bonus pickers ── */}
      {!lockState && (
        <div style={{ marginTop: 10, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* First to Score */}
            <button
              className={`bonus-trigger ${firstTeam ? 'amber-pick' : ''}`}
              onClick={() => setOpenPanel(p => p === 'fts' ? null : 'fts')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>⚡</span><span>First to score</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {firstTeam && <span style={{ fontSize: 11, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstTeam}</span>}
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: openPanel === 'fts' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
              </span>
            </button>

            {/* First Goalscorer */}
            <button
              className={`bonus-trigger ${firstScorer ? 'blue-pick' : ''}`}
              onClick={() => setOpenPanel(p => p === 'scorer' ? null : 'scorer')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>👕</span><span>First goalscorer</span>
                {scorerPos && (
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                    {scorerPos} +{scorerPts(scorerPos)}pts
                  </span>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {firstScorer && <span style={{ fontSize: 11, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstScorer}</span>}
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-block', transform: openPanel === 'scorer' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
              </span>
            </button>
          </div>

          {/* FTS dropdown */}
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
              </div>
              <button className="drop-clear" onClick={() => pickFTS(null)}>✕ &nbsp;Clear pick</button>
            </div>
          )}

          {/* Scorer dropdown */}
          {openPanel === 'scorer' && (
            <div className="drop-panel">
              <div className="drop-header">Who scores first? · Position earns bonus pts</div>
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
                          const pts = scorerPts(p.pos)
                          const ptColor = p.pos === 'GK' || ['CB','RB','LB'].includes(p.pos) ? 'var(--blue)'
                                        : ['CM','AM'].includes(p.pos) ? '#a78bfa' : 'var(--text-3)'
                          return (
                            <button key={p.id} className={`player-row ${firstScorer === p.name ? 'selected' : ''}`} onClick={() => pickScorer(p.name, p.pos)}>
                              <span className="player-pos">{p.pos}</span>
                              <span className="player-name">{p.name}</span>
                              <span style={{ fontSize: 10, color: ptColor, width: 20, textAlign: 'right' }}>+{pts}</span>
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

      {/* ── Post-result: prediction vs actual comparison ── */}
      {isPast && result && bd && (
        <div style={{ marginTop: 10, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          {/* Side-by-side comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {/* Your prediction */}
            <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>Your prediction</div>
              <div style={{
                fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700,
                color: bd.exactBonus > 0 ? 'var(--green)' : bd.result > 0 ? 'var(--amber)' : 'var(--text-3)',
              }}>
                {homeScore} – {awayScore}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                {firstTeam ? `⚡ ${firstTeam}` : '⚡ no pick'}<br />
                {firstScorer ? `👕 ${firstScorer} (${scorerPos})` : '👕 no pick'}
              </div>
            </div>

            {/* Actual result */}
            <div style={{ background: 'rgba(74,222,128,.05)', border: '.5px solid rgba(74,222,128,.15)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 5 }}>Actual result</div>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                {result.homeScore} – {result.awayScore}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 3 }}>
                ⚡ {result.firstTeamScore || '—'}<br />
                👕 {result.firstScorer || '—'} {result.firstScorerPos ? `(${result.firstScorerPos})` : ''}
              </div>
            </div>
          </div>

          {/* Points breakdown tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {bd.result      > 0 && <Tag color="green">+{bd.result} result</Tag>}
            {bd.homeGoal    > 0 && <Tag color="green">+1 {match.home.name.split(' ')[0]} goals</Tag>}
            {bd.awayGoal    > 0 && <Tag color="green">+1 {match.away.name.split(' ')[0]} goals</Tag>}
            {bd.exactBonus  > 0 && <Tag color="green">+3 exact bonus</Tag>}
            {bd.firstTeam   > 0 && <Tag color="amber">+2 first team</Tag>}
            {bd.firstScorer > 0 && <Tag color="blue">+{bd.firstScorer} scorer ({result.firstScorerPos})</Tag>}
            {bd.total === 0     && <Tag color="gray">no points this match</Tag>}
          </div>
        </div>
      )}
    </div>
  )
}

function Tag({ color, children }) {
  const styles = {
    green: { background: 'var(--green-dim)', color: 'var(--green)' },
    amber: { background: 'var(--amber-dim)', color: 'var(--amber)' },
    blue:  { background: 'var(--blue-dim)',  color: 'var(--blue)'  },
    gray:  { background: 'rgba(255,255,255,.06)', color: 'var(--text-3)' },
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
