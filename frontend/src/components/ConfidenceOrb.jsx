export default function ConfidenceOrb({ score }) {
    let level = 'high'
    let label = `${score}% confidence`

    if (score < 70) {
        level = 'low'
        label += ' — verify this result'
    } else if (score < 90) {
        level = 'medium'
    }

    return (
        <div className="confidence-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <div className={`confidence-orb ${level}`} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {score}%
            </span>
            <div className="confidence-tooltip">{label}</div>
        </div>
    )
}
