import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedRoute from './auth/ProtectedRoute'
import NeuralBackground from './components/NeuralBackground'
import QueryTerminal from './components/QueryTerminal'
import PipelineTracer from './components/PipelineTracer'
import ChartCard from './components/ChartCard'
import ChatHistory from './components/ChatHistory'
import AutoAnalysis, { AutoAnalysisLoader } from './components/AutoAnalysis'
import NarrativeReport from './components/NarrativeReport'
import DatasetSwitcher from './components/DatasetSwitcher'
import DashboardView from './components/DashboardView'
import LandingPage from './pages/LandingPage'
import { Moon, Sun, RotateCcw, Clock, Zap, FileText, Database, Settings2, X } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const API_URL = `${API_BASE_URL}/api`

const EMPTY_STATE_SUGGESTIONS = [
    { text: 'Show total revenue by region', icon: '📊' },
    { text: 'Monthly sales trend for 2024', icon: '📈' },
    { text: 'Top 5 product categories by revenue', icon: '🏆' },
]

export function Dashboard() {
    const [dashboards, setDashboards] = useState([])
    const [loading, setLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [chatHistory, setChatHistory] = useState([])
    const auth = JSON.parse(localStorage.getItem('neuralbi_auth') || '{}')
    const user = auth.user || { name: 'Guest', email: 'guest@neuralbi.ai' }
    const [error, setError] = useState(null)
    const [pipelineStage, setPipelineStage] = useState(0)
    const [showPipeline, setShowPipeline] = useState(false)
    const [progressWidth, setProgressWidth] = useState(0)
    const [showSkeleton, setShowSkeleton] = useState(false)
    const [toast, setToast] = useState(null)
    const [health, setHealth] = useState(null)
    const [showSetupModal, setShowSetupModal] = useState(false)
    const [sessionId, setSessionId] = useState(null)
    const [isDemoMode, setIsDemoMode] = useState(false)
    const [rowCount, setRowCount] = useState(0)
    const [dashboardView, setDashboardView] = useState(false)

    // Global Dataset State
    const [activeTables, setActiveTables] = useState([])
    const [datasetContext, setDatasetContext] = useState(null)
    const [tablesMeta, setTablesMeta] = useState([])

    // AutoAnalysis & Narrative State
    const [autoAnalyses, setAutoAnalyses] = useState([])
    const [autoAnalysisLoading, setAutoAnalysisLoading] = useState(false)
    const [autoAnalysisVisible, setAutoAnalysisVisible] = useState(true)
    const [autoAnalysisDone, setAutoAnalysisDone] = useState(false)

    const [showNarrative, setShowNarrative] = useState(false)
    const [narrativeText, setNarrativeText] = useState('')
    const [narrativeLoading, setNarrativeLoading] = useState(false)

    // New FollowUp State
    const [followUpContext, setFollowUpContext] = useState(null)

    useEffect(() => {
        const saved = sessionStorage.getItem('neuralbi_active_tables')
        if (saved) {
            try { setActiveTables(JSON.parse(saved)) } catch (e) { }
        }
    }, [])

    useEffect(() => {
        sessionStorage.setItem('neuralbi_active_tables', JSON.stringify(activeTables))
    }, [activeTables])

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const handleToggle = useCallback((tableName) => {
        setActiveTables(prev =>
            prev.includes(tableName)
                ? prev.filter(t => t !== tableName)
                : [...prev, tableName]
        )
    }, [])

    // Health check
    useEffect(() => {
        fetch(`${API_URL}/health`)
            .then((r) => r.json())
            .then((data) => {
                setHealth(data)
                if (data.status === 'error' && data.error_type === "MISSING_API_KEY") {
                    setShowSetupModal(true)
                }
                if (!activeTables.length && data.tables?.length > 0) {
                    setActiveTables([data.tables[0].name])
                }
            })
            .catch(() => {
                setShowSetupModal(true)
            })

        fetch(`${API_URL}/tables`)
            .then((r) => r.json())
            .then((data) => {
                if (data.tables?.length > 0) {
                    setTablesMeta(data.tables)
                    const total = data.tables.reduce((sum, t) => sum + t.row_count, 0)
                    setRowCount(total)
                    if (!activeTables.length) {
                        const defaultTable = data.tables[0].name
                        setActiveTables([defaultTable])
                        setDatasetContext({ tables: [defaultTable], focus: "Full Overview", set_at: new Date().toISOString() })
                    }
                }
            })
            .catch(() => { })
    }, [activeTables])

    // Demo mode toggle: Ctrl+Shift+D
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault()
                setIsDemoMode((prev) => !prev)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const runAutoAnalysis = async () => {
        if (!activeTables.length) return
        setAutoAnalysisLoading(true)
        setAutoAnalysisVisible(true)
        setAutoAnalysisDone(false)
        try {
            const res = await fetch(`${API_URL}/auto-analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active_tables: activeTables })
            })
            const data = await res.json()
            if (data.success && data.analyses && data.analyses.length > 0) {
                // Keep the auto-analysis container rendered, but still hide the pipeline loading indicator
                setAutoAnalyses(data.analyses)
            }
        } finally {
            setAutoAnalysisLoading(false)
            setAutoAnalysisDone(true)
            setTimeout(() => setAutoAnalysisDone(false), 3000)
        }
    }

    const generateNarrative = async () => {
        setNarrativeLoading(true)
        setShowNarrative(true)

        const allCharts = [
            ...(autoAnalyses || []).map(a => ({ // Use autoAnalyses state
                title: a.chart_config?.title || a.question,
                chart_type: a.chart_config?.chart_type || 'bar',
                insights: a.insights || [],
                question: a.question,
                data_summary: `${a.row_count || 10} rows`
            })),
            ...dashboards.map(d => ({
                title: d.chart_config?.title || d.question,
                chart_type: d.chart_config?.chart_type || 'bar',
                insights: d.insights || [],
                question: d.question,
                data_summary: `${d.row_count || 10} rows`
            }))
        ]

        try {
            const res = await fetch(`${API_URL}/narrative`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    charts: allCharts,
                    report_type: 'executive',
                    active_tables: activeTables,
                    focus_area: datasetContext?.focus || "Full Overview"
                })
            })
            const data = await res.json()
            if (data.success) {
                setNarrativeText(data.narrative)
            } else {
                setNarrativeText("Failed to generate report: " + data.message)
            }
        } catch (e) {
            setNarrativeText("Network error. Could not reach server.")
        } finally {
            setNarrativeLoading(false)
        }
    }

    const handleQuery = useCallback(async (question, isRetry = false, isFollowUpOverride = false) => {
        if (!isRetry && !isFollowUpOverride) {
            setChatHistory(prev => [{ question, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev])
        }

        setLoading(true)
        setError(null)
        setShowPipeline(true)
        setPipelineStage(0)
        setProgressWidth(5)
        setShowSkeleton(true)

        // Advance pipeline stages
        const stageInterval = setInterval(() => {
            setPipelineStage((prev) => {
                if (prev < 4) return prev + 1
                return prev
            })
        }, 1200)

        // Progress bar rubric timings
        setTimeout(() => setProgressWidth(30), 500)
        setTimeout(() => setProgressWidth(70), 3000)
        setTimeout(() => setProgressWidth(95), 6000)

        try {
            const endpoint = (isFollowUpOverride && sessionId) ? `${API_URL}/follow-up` : `${API_URL}/query`

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    session_id: sessionId,
                    demo_mode: isDemoMode,
                    active_tables: activeTables,
                    follow_up_context: followUpContext // Pass followUpContext
                }),
            })

            clearInterval(stageInterval)
            setProgressWidth(100)
            setPipelineStage(5)

            const data = await res.json()

            setTimeout(() => {
                setShowPipeline(false)
                setProgressWidth(0)
                setShowSkeleton(false)
            }, 500)

            if (data.success) {
                setSessionId(data.session_id)
                // Add follow-up flags if overriding from mode B
                if (isFollowUpOverride && followUpContext) {
                    setDashboards(prev => [{ ...data, id: Date.now(), question, is_followup: true, followup_of: followUpContext.chart_title }, ...prev])
                } else {
                    setDashboards(prev => [{ ...data, id: Date.now(), question }, ...prev])
                }

                showToast(`Chart generated — ${data.row_count} rows analyzed`, 'success')
            } else {
                if (data.error_type === "RATE_LIMIT" && !isRetry) {
                    showToast("⏳ AI is busy. Retrying in 5 seconds...", "warning")
                    setTimeout(() => handleQuery(question, true), 5000)
                    return
                }

                setDashboards((prev) => [
                    {
                        id: Date.now(),
                        question,
                        error: true,
                        error_type: data.error_type,
                        message: data.message || data.reason,
                        suggestions: data.suggestions,
                        available_columns: data.available_columns,
                        sql_used: data.sql_used || data.sql_attempted,
                    },
                    ...prev,
                ])
            }
        } catch (e) {
            clearInterval(stageInterval)
            setProgressWidth(0)
            setShowPipeline(false)
            setShowSkeleton(false)

            setDashboards((prev) => [
                {
                    id: Date.now(),
                    question,
                    error: true,
                    error_type: 'NETWORK_ERROR',
                    message: "Can't reach the server.",
                },
                ...prev,
            ])
        } finally {
            if (!isRetry) {
                setTimeout(() => setLoading(false), 500)
            }
            setFollowUpContext(null) // Clear follow-up context after query
        }
    }, [sessionId, isDemoMode, showToast, activeTables, followUpContext])

    const handleRemoveDashboard = (id) => {
        setDashboards((prev) => prev.filter((d) => d.id !== id))
    }

    const handleDragStart = (e) => {
        setIsDragging(true)
    }

    // --- Follow-up Handlers ---
    const handleChatWithChart = (analysis) => {
        setFollowUpContext({
            source: 'auto_analysis',
            chart_title: analysis.chart_config?.title,
            original_question: analysis.question,
            sql_query: analysis.sql_query,
            chart_config: analysis.chart_config,
            data_sample: analysis.data?.slice(0, 5) || []
        })

        // Scroll to terminal
        document.getElementById('query-terminal')?.scrollIntoView({ behavior: 'smooth' })

        // Focus the input directly on next tick
        setTimeout(() => {
            document.getElementById('query-input')?.focus()
        }, 100)

        // Handle auto-submit mechanism if it was kicked off from a quick-chip
        if (analysis.quickAction) {
            setTimeout(() => {
                const inputElement = document.getElementById('query-input')
                if (inputElement) {
                    const reactProps = Object.keys(inputElement).find(k => k.startsWith('__reactProps$'))
                    if (reactProps) {
                        inputElement[reactProps].onChange({ target: { value: analysis.quickAction } })
                    }
                }
            }, 150)
        }
    }

    const clearFollowUpContext = () => {
        setFollowUpContext(null)
    }

    const handleNewSession = () => {
        setDashboards([])
        setSessionId(null)
        setError(null)
        setAutoAnalysis(null) // Clear auto-analysis on new session
        setFollowUpContext(null) // Clear follow-up context on new session
    }

    const handleUploadSuccess = (data) => {
        const name = data.table_name || data.table
        setActiveTables(prev => prev.includes(name) ? prev : [...prev, name])
    }

    return (
        <div style={{ position: 'relative', minHeight: '100vh' }}>
            <NeuralBackground isQuerying={loading} />

            {/* Progress Bar */}
            {progressWidth > 0 && (
                <div className="progress-bar-top" style={{ width: `${progressWidth}%`, transition: 'width 0.4s ease' }} />
            )}

            {/* Header */}
            <header className="header" style={{ position: 'fixed', top: 0, width: '100%', zIndex: 100 }}>
                <div className="header-logo">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="16" cy="16" r="14" stroke="url(#grad)" strokeWidth="2" fill="none" />
                        <circle cx="16" cy="10" r="3" fill="#6366f1" />
                        <circle cx="10" cy="20" r="3" fill="#06b6d4" />
                        <circle cx="22" cy="20" r="3" fill="#10b981" />
                        <line x1="16" y1="10" x2="10" y2="20" stroke="#6366f1" strokeWidth="1.5" opacity="0.5" />
                        <line x1="16" y1="10" x2="22" y2="20" stroke="#06b6d4" strokeWidth="1.5" opacity="0.5" />
                        <line x1="10" y1="20" x2="22" y2="20" stroke="#10b981" strokeWidth="1.5" opacity="0.5" />
                        <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
                                <stop stopColor="#6366f1" />
                                <stop offset="1" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <h1>NeuralBI</h1>
                </div>

                <div className="header-status">
                    <div className="status-pill">🤖 Llama 3.3 70B</div>
                    <div className="status-pill">
                        {loading ? '⏳ Thinking...' : '⚡ Ready'}
                    </div>
                    {isDemoMode && <span className="demo-badge" style={{ background: '#f59e0b', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>🎯 Demo Mode</span>}
                </div>

                <div className="header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        className="btn-ghost"
                        onClick={runAutoAnalysis}
                        disabled={!activeTables.length || autoAnalysisLoading}
                        title={!activeTables.length ? 'Select a dataset first' : ''}
                        style={{
                            padding: '6px 12px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px',
                            border: '1px solid rgba(99,102,241,0.4)',
                            opacity: !activeTables.length ? 0.4 : 1,
                            cursor: !activeTables.length ? 'not-allowed' : autoAnalysisLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {autoAnalysisLoading
                            ? <><span style={{ animation: 'spin 2s linear infinite' }}>⏳</span> Analyzing...</>
                            : autoAnalysisDone
                                ? <>✅ Analysis Ready</>
                                : <><Zap size={14} /> Auto-Analyze</>}
                    </button>
                    <button
                        onClick={() => setDashboardView(true)}
                        disabled={!activeTables.length}
                        style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            padding: '6px 14px', borderRadius: '8px', color: 'white',
                            display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', fontWeight: 600,
                            border: 'none', cursor: !activeTables.length ? 'not-allowed' : 'pointer',
                            opacity: !activeTables.length ? 0.4 : 1
                        }}
                    >
                        📊 Dashboard
                    </button>
                    {(dashboards.length > 0 || (autoAnalyses && autoAnalyses.length > 0)) && ( // Use autoAnalyses state
                        <button onClick={generateNarrative} disabled={narrativeLoading} style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-cyan))', padding: '6px 14px', borderRadius: '8px', color: 'white', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: narrativeLoading ? 0.7 : 1 }}>
                            {narrativeLoading ? <span style={{ animation: 'spin 2s linear infinite' }}>⏳</span> : <FileText size={14} />} {narrativeLoading ? 'Writing report...' : 'Generate Report'}
                        </button>
                    )}
                    <button className="btn-ghost" onClick={handleNewSession} style={{ padding: '6px 12px' }} title="New Session">
                        <RotateCcw size={14} />
                    </button>
                    <button className="btn-ghost" onClick={() => setHistoryOpen(true)} style={{ padding: '6px 12px' }} title="Chat History">
                        <Clock size={14} />
                    </button>

                    <style>{`@media (max-width: 768px) { .user-name-desktop { display: none !important; } }`}</style>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginLeft: '8px' }}
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }} className="user-name-desktop">{user.name}</span>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 'bold', fontSize: '16px'
                        }}>
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    </div>
                    {showDropdown && (
                        <div className="glass-card" style={{
                            position: 'absolute', top: '50px', right: 0, minWidth: '200px',
                            padding: '8px 0', zIndex: 200, borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>👤 {user.name}</div>
                            <div style={{ padding: '0 16px 8px', color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>📧 {user.email}</div>
                            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
                            <button
                                className="btn-ghost"
                                style={{ width: '100%', textAlign: 'left', padding: '8px 16px', color: 'var(--text-primary)', justifyContent: 'flex-start', borderRadius: 0 }}
                                onMouseOver={(e) => e.target.style.color = 'var(--accent-red)'}
                                onMouseOut={(e) => e.target.style.color = 'var(--text-primary)'}
                                onClick={() => { localStorage.removeItem('neuralbi_auth'); window.location.href = '/login'; }}
                            >
                                🚪 Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <DatasetSwitcher activeTables={activeTables} onToggle={handleToggle} tablesMeta={tablesMeta} />

            {/* Main Area */}
            <main className="main-area" style={{ marginLeft: '260px', paddingTop: '80px', paddingBottom: '120px', width: 'calc(100% - 260px)' }}>

                {dashboardView && (
                    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 80px)' }}>
                        <DashboardView activeTables={activeTables} onClose={() => setDashboardView(false)} />
                    </div>
                )}

                {!dashboardView && (
                    <div style={{
                        maxWidth: '1200px', margin: '0 auto', width: '100%',
                        position: 'relative', display: 'flex', flexDirection: 'column',
                        minHeight: 'calc(100vh - 200px)'
                    }}>
                        {/* Always show QueryTerminal now across modes */}
                        <div id="query-terminal" style={{
                            width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column'
                        }}>
                            <QueryTerminal
                                onSubmit={handleQuery}
                                loading={loading}
                                error={error}
                                activeTables={activeTables}
                                onUploadSuccess={handleUploadSuccess}
                                followUpContext={followUpContext}
                                onClearFollowUp={clearFollowUpContext}
                            />
                        </div>

                        {/* Pipeline Tracer */}
                        <PipelineTracer stage={pipelineStage} visible={showPipeline} />

                        {/* Auto Analysis */}
                        {autoAnalysisLoading && <AutoAnalysisLoader rowCount={rowCount} tableCount={health?.tables?.length || 1} />}
                        {!autoAnalysisLoading && autoAnalyses && autoAnalyses.length > 0 && autoAnalysisVisible && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                style={{ marginTop: '20px' }}
                            >
                                <AutoAnalysis
                                    analyses={autoAnalyses.map(a => ({ ...a, onChatWithChart: handleChatWithChart }))}
                                    onRefresh={runAutoAnalysis}
                                    onHide={() => setAutoAnalysisVisible(false)}
                                />
                            </motion.div>
                        )}

                        {/* Empty State */}
                        {dashboards.length === 0 && !showSkeleton && !autoAnalysisLoading && (!autoAnalyses || autoAnalyses.length === 0 || !autoAnalysisVisible) && (
                            <div className="empty-state">
                                <div className="empty-state-robot">🤖</div>
                                {activeTables.length > 0 ? (
                                    <>
                                        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 'bold', fontSize: '22px' }}>
                                            Ready to analyze {activeTables.join(', ')}
                                        </h2>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Click ⚡ Auto-Analyze for an instant AI briefing</p>
                                        <p style={{ color: 'var(--text-secondary)' }}>Or type your own question below</p>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                            <button
                                                className="empty-state-cta-primary"
                                                onClick={runAutoAnalysis}
                                                disabled={autoAnalysisLoading}
                                            >
                                                ⚡ Auto-Analyze
                                            </button>
                                            <button
                                                className="btn-ghost empty-state-cta-ghost"
                                                onClick={() => document.querySelector('.terminal-input')?.focus()}
                                            >
                                                💬 Ask a Question
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 'bold', fontSize: '22px' }}>
                                            Ready to analyze your data
                                        </h2>
                                        <p className="empty-state-no-dataset">
                                            <span className="empty-state-arrow">←</span> Select datasets from the left panel to begin
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="dashboard-grid">
                            {/* Skeleton Container inside grid to match real card size */}
                            {showSkeleton && (
                                <div className="glass-card layout-animation" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="skeleton-line" style={{ width: '40%', height: '28px', borderRadius: '4px' }} />
                                    <div className="skeleton-line" style={{ width: '25%', height: '16px', borderRadius: '4px' }} />
                                    <div className="skeleton-chart" style={{ width: '100%', height: '320px', borderRadius: '8px', marginTop: '10px' }} />
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <div className="skeleton-line" style={{ width: '10px', height: '10px', borderRadius: '50%' }} />
                                        <div className="skeleton-line" style={{ width: '80%', height: '16px', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div className="skeleton-line" style={{ width: '10px', height: '10px', borderRadius: '50%' }} />
                                        <div className="skeleton-line" style={{ width: '65%', height: '16px', borderRadius: '4px' }} />
                                    </div>
                                </div>
                            )}

                            {dashboards.map((d) =>
                                d.error ? (
                                    <ErrorCard
                                        key={d.id}
                                        dashboard={d}
                                        onSuggestionClick={handleQuery}
                                        onRetry={() => handleQuery(d.question)}
                                    />
                                ) : (
                                    <ChartCard
                                        key={d.id}
                                        dashboard={d}
                                        onRemove={() => handleRemoveDashboard(d.id)}
                                        onSuggestionClick={handleQuery}
                                    />
                                )
                            )}
                        </div>
                    </div>
                )}
            </main>

            <ChatHistory
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                history={chatHistory}
                onSelectQuery={(q) => handleQuery(q, false, false)}
            />

            {showNarrative && (
                <NarrativeReport
                    loading={narrativeLoading}
                    narrative={narrativeText}
                    chartCount={autoAnalyses.length + dashboards.length}
                    onClose={() => setShowNarrative(false)}
                />
            )}

            {/* Terminal */}
            {!dashboardView && (
                <div style={{ position: 'fixed', bottom: 0, left: '260px', width: 'calc(100% - 260px)', zIndex: 100 }}>
                    <QueryTerminal
                        onSubmit={handleQuery}
                        loading={loading}
                        error={error}
                        activeTables={activeTables}
                        onUploadSuccess={(data) => {
                            const name = data.table_name || data.table
                            setActiveTables(prev => prev.includes(name) ? prev : [...prev, name])
                        }}
                    />
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast layout-animation`}>
                    {toast.type === 'success' ? '✅' : '⏳'} {toast.message}
                </div>
            )}

            {/* Setup Modal */}
            {showSetupModal && (
                <div className="setup-modal-overlay" onClick={() => setShowSetupModal(false)}>
                    <div className="setup-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>⚙️ Setup Required</h2>
                        <p>Add your Groq API key to backend/.env:</p>
                        <code style={{ display: 'block', padding: '12px', background: '#0d1117', borderRadius: '6px', margin: '16px 0' }}>GROQ_API_KEY=your_key_here</code>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Get a free key at: console.groq.com
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function ErrorCard({ dashboard, onSuggestionClick, onRetry }) {
    const { error_type, message, suggestions, available_columns, sql_used, question } = dashboard

    if (error_type === 'VAGUE') {
        return (
            <div className="error-card vague layout-animation">
                <div className="error-card-icon">🤔</div>
                <h3>Could you be more specific?</h3>
                <p>I need to know:<br />📊 What metric? (revenue, units, customers...)<br />📅 What time period? (Q3, last 6 months, 2024...)<br />🔍 What dimension? (by region, by product, by customer...)</p>
                {suggestions?.length > 0 && (
                    <div className="error-suggestions">
                        {suggestions.map((s, i) => (
                            <button key={i} className="btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: '8px' }} onClick={() => onSuggestionClick(s)}>→ {s}</button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    if (error_type === 'INSUFFICIENT_DATA') {
        return (
            <div className="error-card insufficient layout-animation" style={{ padding: '24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔍</div>
                <h3>I can't answer this question</h3>
                <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>Reason: {message}</p>
                </div>
                {available_columns?.length > 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        <p style={{ fontWeight: 600, color: 'white', marginBottom: '8px' }}>Available data includes:</p>
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            <li>{available_columns.slice(0, 3).join(', ')}</li>
                            <li>{available_columns.slice(3, 6).join(', ')}</li>
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    if (error_type === 'EMPTY_RESULTS') {
        return (
            <div className="error-card empty layout-animation">
                <div className="error-card-icon">📭</div>
                <h3>No matching records</h3>
                <p>Your query ran successfully but found no matching records.</p>
                {sql_used && (
                    <pre style={{ fontSize: '11px', color: 'var(--text-muted)', background: '#0d1117', padding: '8px', borderRadius: '8px', overflowX: 'auto', margin: '12px 0' }}>
                        {sql_used}
                    </pre>
                )}
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
                    <p>Suggestions:</p>
                    <ul style={{ paddingLeft: '20px' }}>
                        <li>Try a broader date range</li>
                        <li>Check if the region/category name is spelled correctly</li>
                    </ul>
                </div>
            </div>
        )
    }

    if (error_type === 'TIMEOUT') {
        return (
            <div className="error-card layout-animation" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div className="error-card-icon">⏱️</div>
                <h3>Request Timeout</h3>
                <p>This question was too complex for a quick answer.</p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' }}>
                    <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Instead of: '{question}'</p>
                    <p style={{ margin: 0, color: 'white' }}>Try breaking it into simpler parts.</p>
                </div>
                <button className="retry-btn" style={{ marginTop: '16px' }} onClick={onRetry}>Try Again</button>
            </div>
        )
    }

    if (error_type === 'NETWORK_ERROR') {
        return (
            <div className="error-card network layout-animation">
                <div className="error-card-icon">🔌</div>
                <h3>Can't reach the server.</h3>
                <p>Is the backend running? <br />(<code>cd backend && uvicorn main:app --reload --port 8080</code>)</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Expected at: http://localhost:8080</p>
                <button className="retry-btn" style={{ marginTop: '12px' }} onClick={onRetry}>Try Again</button>
            </div>
        )
    }

    return (
        <div className="error-card api-error layout-animation">
            <div className="error-card-icon">⚠️</div>
            <h3>{error_type === 'SQL_FAILED' ? 'SQL Generation Failed' : 'Request Error'}</h3>
            <p>{message}</p>
            <button className="retry-btn" style={{ marginTop: '12px' }} onClick={onRetry}>Try Again</button>
        </div>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    )
}
