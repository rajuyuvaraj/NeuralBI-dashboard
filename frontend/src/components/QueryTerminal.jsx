import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff } from 'lucide-react'

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

export default function QueryTerminal({ onSubmit, loading, error, activeTable }) {
    const [input, setInput] = useState('')
    const [isRecording, setIsRecording] = useState(false)
    const [loadingMessageIdx, setLoadingMessageIdx] = useState(0)
    const inputRef = useRef(null)
    const recognitionRef = useRef(null)

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
        if (!q || loading || !activeTable) return

        onSubmit(q, false, isFollowUp(q))
        setInput('')
    }

    const handleChipClick = (suggestion) => {
        if (!activeTable) return
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
                            disabled={loading || !activeTable}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="terminal-input-row" style={{ borderColor: !activeTable ? 'rgba(245, 158, 11, 0.4)' : '' }}>

                        {activeTable && (
                            <div style={{
                                background: 'rgba(99,102,241,0.15)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                fontSize: '11px',
                                fontFamily: 'JetBrains Mono, monospace',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginRight: '8px'
                            }}>
                                📊 {activeTable}
                            </div>
                        )}

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
                                placeholder={!activeTable ? "← Select a dataset first" : `Ask anything about ${activeTable}...`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading || !activeTable}
                                autoFocus
                            />
                        )}

                        <button
                            type="button"
                            className={`btn-voice ${isRecording ? 'recording' : ''}`}
                            onClick={toggleVoice}
                            title={isRecording ? 'Stop recording' : 'Voice input'}
                            disabled={!activeTable}
                        >
                            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>

                        <button
                            type="submit"
                            className="btn-send"
                            disabled={loading || !input.trim() || !activeTable}
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
        </div>
    )
}
