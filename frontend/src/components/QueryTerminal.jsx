import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import UploadPanel from './UploadPanel'

const SUGGESTIONS = [
    'Monthly sales by region',
    'Top 10 customers by revenue',
    'Q3 revenue by category',
    'Revenue trend last 12 months',
    'Which sales rep performed best?',
]

const LOADING_MESSAGES = [
    'Understanding your question...',
    'Writing SQL query...',
    'Querying database...',
    'Selecting best chart...',
    'Generating insights...',
]

export default function QueryTerminal({ onSubmit, loading, error, activeTables = [], onUploadSuccess, followUpContext, onClearFollowUp }) {
    const [input, setInput] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [loadingMessageIdx, setLoadingMessageIdx] = useState(0)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const inputRef = useRef(null)
    const recognitionRef = useRef(null)

    const ACCENT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']

    // Listen for external appends (e.g., from DatasetOverview column chips)
    useEffect(() => {
        const handleAppend = (e) => {
            setInput(prev => prev + (prev ? ' ' : '') + e.detail.text)
            inputRef.current?.focus()
        }
        window.addEventListener('appendToQuery', handleAppend)
        return () => window.removeEventListener('appendToQuery', handleAppend)
    }, [])

    // Cycle loading messages
    useEffect(() => {
        if (!loading) {
            setLoadingMessageIdx(0)
            return
        }
        const interval = setInterval(() => {
            setLoadingMessageIdx((prev) => (prev + 1) % LOADING_MESSAGES.length)
        }, 1200)
        return () => clearInterval(interval)
    }, [loading])

    const isFollowUp = (q) => {
        const qLower = q.toLowerCase();
        const hasPronoun = ['it', 'them', 'that', 'those', 'previous', 'this', 'versus', 'vs'].some(p => qLower.match(new RegExp(`\\b${p}\\b`)));
        const hasVerb = /\b(show|get|list|find|display|count|sum|average|calculate|what)\b/i.test(qLower);
        return hasPronoun || !hasVerb;
    }

    const handleSubmit = (e) => {
        e?.preventDefault()
        const q = input.trim()
        if (!q || loading || !activeTables.length) return

        if (followUpContext) {
            // MODE B
            onSubmit(q, false, true) // isFollowUpOverride = true
        } else {
            // MODE A
            onSubmit(q, false, isFollowUp(q))
        }

        setInput('')
    }

    const handleChipClick = (suggestion) => {
        if (!activeTables.length) return
        setInput(suggestion)
        onSubmit(suggestion, false, false) // chips are usually new queries
    }

    const toggleVoice = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            return
        }

        if (isRecording) {
            recognitionRef.current?.stop()
            setIsRecording(false)
            return
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript
            setInput(transcript)
            setIsRecording(false)
        }

        recognition.onerror = () => {
            setIsRecording(false)
        }

        recognition.onend = () => {
            setIsRecording(false)
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsRecording(true)
    }

    return (
        <div className="terminal-container">
            <div className="terminal-inner">
                <div className="suggestion-chips">
                    {SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            className="chip"
                            onClick={() => handleChipClick(s)}
                            disabled={loading || !activeTables.length}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* Follow-up Context Pill */}
                {followUpContext && (
                    <div style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-primary)'
                    }}>
                        <span>
                            <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>↩</span>
                            Following up on: <strong> "{followUpContext.chart_title}"</strong>
                        </span>
                        <button onClick={onClearFollowUp} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }} title="Clear Follow-up">
                            <X size={14} />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="terminal-input-row" style={{ borderColor: !activeTables.length ? 'rgba(245, 158, 11, 0.4)' : '' }}>

                        {activeTables.length === 0 ? (
                            <div style={{
                                background: 'rgba(245,158,11,0.15)',
                                border: '1px solid rgba(245,158,11,0.4)',
                                fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
                                padding: '3px 8px', borderRadius: '6px',
                                color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px'
                            }}>
                                ⚠️ No dataset
                            </div>
                        ) : activeTables.slice(0, 3).map((tName, idx) => (
                            <div key={tName} style={{
                                background: `${ACCENT_COLORS[idx % ACCENT_COLORS.length]}26`,
                                border: `1px solid ${ACCENT_COLORS[idx % ACCENT_COLORS.length]}4D`,
                                fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
                                padding: '3px 8px', borderRadius: '6px',
                                color: ACCENT_COLORS[idx % ACCENT_COLORS.length],
                                display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px',
                                whiteSpace: 'nowrap'
                            }}>
                                📊 {tName}{activeTables.length > 3 && idx === 2 ? ` +${activeTables.length - 3}` : ''}
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => setShowUploadModal(true)}
                            title="Add dataset"
                            style={{
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 600,
                                fontFamily: 'JetBrains Mono, monospace',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginRight: '8px',
                                transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <Plus size={12} /> Add
                        </button>

                        <div className={`terminal-dot ${loading ? 'loading' : ''}`} />

                        {loading ? (
                            <span className="loading-text">
                                {LOADING_MESSAGES[loadingMessageIdx]}
                            </span>
                        ) : (
                            <input
                                ref={inputRef}
                                type="text"
                                className="terminal-input"
                                placeholder={
                                    !activeTables.length ? "← Select a dataset first" :
                                        followUpContext ? `Ask a follow-up about '${followUpContext.chart_title}'...` :
                                            activeTables.length === 1 ? `Ask anything about ${activeTables[0]}...` :
                                                `Ask anything about ${activeTables.join(', ')}...`
                                }
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading || !activeTables.length}
                                autoFocus
                            />
                        )}

                        <button
                            type="button"
                            className={`btn-voice ${isRecording ? 'recording' : ''}`}
                            onClick={toggleVoice}
                            title={isRecording ? 'Stop recording' : 'Voice input'}
                            disabled={!activeTables.length}
                        >
                            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>

                        <button
                            type="submit"
                            className="btn-send"
                            disabled={loading || !input.trim() || !activeTables.length}
                            title="Send query"
                        >
                            {loading ? (
                                <div className="spinner" />
                            ) : (
                                <Send size={16} />
                            )}
                        </button>
                    </div>
                </form>

                {error && (
                    <div style={{
                        textAlign: 'center',
                        marginTop: '8px',
                        fontSize: '12px',
                        color: 'var(--accent-red)',
                    }}>
                        {error}
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <motion.div
                        className="upload-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setShowUploadModal(false)}
                    >
                        <motion.div
                            className="upload-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="upload-modal-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>📊</span>
                                    <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Add Dataset</span>
                                </div>
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="btn-ghost"
                                    style={{ padding: '4px', borderRadius: '6px' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="upload-modal-body">
                                <UploadPanel
                                    onUploadSuccess={(data) => {
                                        onUploadSuccess?.(data)
                                        setShowUploadModal(false)
                                    }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
