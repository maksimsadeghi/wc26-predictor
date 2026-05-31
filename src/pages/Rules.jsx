export default function Rules() {
  return (
    <div className="page">
      <h1 className="page-title">How to Play</h1>
      <p className="page-sub">Everything you need to know about making picks and earning points.</p>

      <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📋 The Basics</h2>
        <ul style={{ paddingLeft: 18, color: 'var(--text-2)', lineHeight: 2, fontSize: 14 }}>
          <li>Predict the score of each match before it kicks off.</li>
          <li>Picks <strong style={{ color: 'var(--text-1)' }}>lock 30 minutes before kickoff</strong> — no changes made after that.</li>
          <li>You can also pick bonus questions: the first team to score and the first goalscorer.</li>
          <li><strong style={{ color: 'var(--text-1)' }}>Picks are auto-saved</strong> as you type — no submit button needed.</li>
          <li>If you don't submit a pick before kickoff, you get 0 points for that match.</li>
          <li>Extra time goals count toward your score prediction. Penalty shootouts do not.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🏆 Points System</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Correct result (win/draw/loss)" pts="4 pts" color="var(--green)" />
          <Row label="Exact home team goals" pts="+1 pt" color="var(--green)" />
          <Row label="Exact away team goals" pts="+1 pt" color="var(--green)" />
          <Row label="Exact scoreline bonus" pts="+3 pts" color="var(--green)" note="on top of the above — exact score = 9 pts total" />
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
          <Row label="First team to score" pts="+2 pts" color="var(--amber)" />
          <Row label="First goalscorer — outfield player" pts="+4 pts" color="var(--blue)" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🐉 Underdog Bonuses</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Extra points for going against the crowd and getting it right.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row
            label="Rare scoreline — fewer than 5% of your league picked the same exact score"
            pts="+2 pts"
            color="var(--amber)"
          />
          <Row
            label="Rare scorer — fewer than 5% of your league picked the same first goalscorer"
            pts="+2 pts"
            color="var(--amber)"
          />
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>⚙️ Special Picks</h2>
        <ul style={{ paddingLeft: 18, color: 'var(--text-2)', lineHeight: 2, fontSize: 14 }}>
          <li><strong style={{ color: 'var(--text-1)' }}>No goals</strong> — pick this if you think neither team will score first (0–0 game). Earns the first team bonus if correct.</li>
          <li><strong style={{ color: 'var(--text-1)' }}>No scorer</strong> — pick this if you think no one scores (0–0). Earns the first scorer bonus if correct.</li>
        </ul>
      </div>
    </div>
  )
}

function Row({ label, pts, color, note }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ fontSize: 14, color: 'var(--text-2)', flex: 1 }}>
        {label}
        {note && <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'block' }}>{note}</span>}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{pts}</span>
    </div>
  )
}
