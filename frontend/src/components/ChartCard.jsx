import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pin, Download, X, Code2, Copy, Check, MessageSquare, Send } from 'lucide-react'
import html2canvas from 'html2canvas'
import ChartRenderer from './ChartRenderer'
import InsightPanel from './InsightPanel'
import ConfidenceOrb from './ConfidenceOrb'
import FollowUpChips from './FollowUpChips'

function highlightSQL(sql) {
    if (!sql) return ''
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT',
        'JOIN', 'ON', 'AND', 'OR', 'AS', 'IN', 'NOT', 'HAVING',
        'LEFT', 'RIGHT', 'INNER', 'OUTER', 'DISTINCT', 'BETWEEN',
        'ASC', 'DESC', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    ]
    const functions = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'STRFTIME', 'ROUND', 'COALESCE']

    let result = sql
    keywords.forEach((kw) => {
        const regex = new RegExp(`\\b(${kw})\\b`, 'gi')
        result = result.replace(regex, `<span class="sql-keyword">$1</span>`)
    })
    functions.forEach((fn) => {
        const regex = new RegExp(`\\b(${fn})\\b`, 'gi')
        result = result.replace(regex, `<span class="sql-function">$1</span>`)
    })
    // Strings
    result = result.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>')
    // Numbers
    result = result.replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>')

    return result
}

export default function ChartCard({ dashboard, onRemove, onSuggestionClick }) {
    const { question, data, chart_config, sql_query, insights, confidence } = dashboard
    const [showSQL, setShowSQL] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [chatHistory, setChatHistory] = useState([])
    const [copied, setCopied] = useState(false)
    const [pinned, setPinned] = useState(false)
    const chartRef = useRef(null)

    const handleDownload = useCallback(async () => {
        if (!chartRef.current) return
        try {
            const canvas = await html2canvas(chartRef.current, {
                backgroundColor: '#0a1628',
                scale: 2,
            })
            const link = document.createElement('a')
            link.download = `${chart_config?.title || 'chart'}.png`
            link.href = canvas.toDataURL()
            link.click()
        } catch (err) {
            console.error('Download failed:', err)
        }
    }, [chart_config])

    const handleCopySQL = useCallback(() => {
        navigator.clipboard.writeText(sql_query || '')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [sql_query])

    const handleSendChat = (e) => {
        e?.preventDefault()
        if (!chatInput.trim()) return

        // Add to local chat card history for visual feedback
        setChatHistory(prev => [...prev, { text: chatInput, isUser: true }])

        // Triggers App's handleQuery(question, isRetry, isFollowUpOverride)
        onSuggestionClick(chatInput, false, true)

        setChatInput('')
    }

    const handleChip = (text) => {
        setChatInput(text)
        setChatHistory(prev => [...prev, { text, isUser: true }])
        onSuggestionClick(text, false, true)
    }

    const badgeClass = `chart-type-badge badge-${chart_config?.chart_type || 'bar'}`

    return (
        <motion.div
            className="glass-card chart-card"
            initial={{ opacity: 0, scale: 0.85, y: 40, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            style={{ display: 'flex', padding: 0, overflow: 'hidden' }}
        >
            <div style={{ flex: 1, padding: '24px', position: 'relative' }}>
                {/* Header */}
                <div className="chart-card-header">
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <div>
                                <h3 className="chart-card-title" style={{ margin: 0 }}>{chart_config?.title || question}</h3>
                                {dashboard.is_followup && (
                                    <div style={{
                                        fontSize: '10px', color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)',
                                        border: '1px solid rgba(6,182,212,0.2)', borderRadius: '4px', padding: '2px 8px',
                                        display: 'inline-block', marginTop: '4px'
                                    }}>
                                        ↩ Follow-up of: {dashboard.followup_of}
                                    </div>
                                )}
                            </div>
                            <span className={badgeClass}>{chart_config?.chart_type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <span>{data?.length || 0} rows</span>
                            <span>•</span>
                            <ConfidenceOrb score={confidence || 0} />
                        </div>
                    </div>
                    <div className="chart-card-actions">
                        <button
                            onClick={() => setPinned(!pinned)}
                            title="Pin"
                            style={pinned ? { color: 'var(--accent-amber)' } : {}}
                        >
                            <Pin size={14} />
                        </button>
                        <button onClick={handleDownload} title="Download PNG">
                            <Download size={14} />
                        </button>
                        <button onClick={onRemove} title="Remove">
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Chart */}
                <div ref={chartRef}>
                    <ChartRenderer data={data} config={chart_config} />
                </div>

                {/* Drawers Toggle */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button className="sql-drawer-toggle" onClick={() => { setShowSQL(!showSQL); setShowChat(false); }} style={{ marginTop: 0 }}>
                        <Code2 size={14} />
                        <span>{showSQL ? 'Hide SQL' : '{ } View SQL'}</span>
                    </button>
                    <button className="sql-drawer-toggle" onClick={() => { setShowChat(!showChat); setShowSQL(false); }} style={{ marginTop: 0 }}>
                        <MessageSquare size={14} />
                        <span>{showChat ? 'Close Chat' : '💬 Chat'}</span>
                    </button>
                </div>

                {showSQL && (
                    <div className="sql-drawer" style={{ marginTop: '12px' }}>
                        <button className="copy-sql-btn" onClick={handleCopySQL}>
                            {copied ? (
                                <><Check size={12} /> Copied!</>
                            ) : (
                                <><Copy size={12} /> Copy</>
                            )}
                        </button>
                        <pre dangerouslySetInnerHTML={{ __html: highlightSQL(sql_query) }} />
                    </div>
                )}

                {/* Insights */}
                <InsightPanel insights={insights} />
            </div>

            {/* Chat Drawer Side Panel */}
            <AnimatePresence>
                {showChat && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 300, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}
                    >
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Chart Chat</span>
                            <button onClick={() => setShowChat(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {chatHistory.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <p style={{ marginBottom: '12px' }}>Ask follow-up questions to refine this chart.</p>
                                    <FollowUpChips
                                        suggestions={["Change to pie chart", "Sort by value DESC", "Filter top 5 only"]}
                                        onSelect={handleChip}
                                    />
                                </div>
                            ) : (
                                chatHistory.map((msg, i) => (
                                    <div key={i} style={{
                                        padding: '10px 14px', borderRadius: '12px',
                                        background: msg.isUser ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)',
                                        alignSelf: msg.isUser ? 'flex-end' : 'flex-start', maxWidth: '85%',
                                        fontSize: '13px', color: msg.isUser ? 'var(--accent-primary)' : 'var(--text-primary)',
                                        border: msg.isUser ? '1px solid rgba(99,102,241,0.2)' : '1px solid var(--glass-border)'
                                    }}>
                                        {msg.text}
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ padding: '12px', borderTop: '1px solid var(--glass-border)' }}>
                            <form onSubmit={handleSendChat} style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '24px', padding: '4px 4px 4px 16px', border: '1px solid var(--glass-border)' }}>
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder="Ask about this chart..."
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none' }}
                                />
                                <button type="submit" disabled={!chatInput.trim()} style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', opacity: chatInput.trim() ? 1 : 0.5 }}>
                                    <Send size={12} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
