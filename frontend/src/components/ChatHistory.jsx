import { X, MessageSquare, Clock } from 'lucide-react'

export default function ChatHistory({ isOpen, onClose, history, onSelectQuery }) {
    if (!isOpen) return null
    return (
        <div className="chat-history-panel glass-card" style={{
            position: 'fixed', right: 0, top: '80px', bottom: 0, width: '320px', zIndex: 150,
            animation: 'slideInRight 0.3s ease', display: 'flex', flexDirection: 'column',
            borderRight: 'none', borderRadius: '24px 0 0 24px'
        }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}><Clock size={16} /> History</h3>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '13px' }}>
                        No queries yet in this session
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {history.map((item, i) => (
                            <div key={i} className="history-item" onClick={() => { onSelectQuery(item.question); onClose(); }} style={{
                                padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s'
                            }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <MessageSquare size={14} style={{ color: 'var(--accent-cyan)', marginTop: '2px', flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.question}</span>
                                </div>
                                {item.time && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>{item.time}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .history-item:hover { background: rgba(255,255,255,0.08) !important; }
            `}</style>
        </div>
    )
}
