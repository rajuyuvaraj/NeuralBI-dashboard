import { ArrowRight } from 'lucide-react'

export default function FollowUpChips({ suggestions, onSelect }) {
    if (!suggestions || suggestions.length === 0) return null

    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            {suggestions.map((s, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(s)}
                    style={{
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: '16px', padding: '6px 14px', fontSize: '12px', color: 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                >
                    {s} <ArrowRight size={12} />
                </button>
            ))}
        </div>
    )
}
