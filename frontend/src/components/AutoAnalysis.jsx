import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, EyeOff, BrainCircuit } from 'lucide-react'
import ChartRenderer from './ChartRenderer'

export function AutoAnalysisLoader({ rowCount = 0, tableCount = 0 }) {
    const steps = [
        "Reading database schema...",
        "Identifying key business questions...",
        "Generating SQL queries...",
        "Fetching data...",
        "Creating visualizations...",
        "Writing insights..."
    ]

    const [activeStep, setActiveStep] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep(prev => (prev < steps.length - 1 ? prev + 1 : prev))
        }, 1500)
        return () => clearInterval(interval)
    }, [steps.length])

    return (
        <div style={{ width: '100%', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px' }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '20px', color: 'var(--accent-primary)',
                    animation: 'pulse 2s infinite'
                }}>
                    <BrainCircuit size={32} />
                </div>

                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                    🤖 Your AI analyst is preparing your briefing
                </h2>

                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                    Analyzing {rowCount} records across {tableCount} datasets...
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', width: '100%', maxWidth: '300px', margin: '0 auto', textAlign: 'left' }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            opacity: i <= activeStep ? 1 : 0.3,
                            transition: 'opacity 0.5s',
                            fontSize: '13px',
                            color: i < activeStep ? 'var(--accent-green)' : i === activeStep ? 'var(--accent-primary)' : 'var(--text-muted)'
                        }}>
                            {i < activeStep ? '✓' : i === activeStep ? <span style={{ animation: 'spin 2s linear infinite' }}>⏳</span> : '○'}
                            {step}
                        </div>
                    ))}
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '40px', opacity: 0.7 }}>
                    This happens automatically every time you open NeuralBI
                </p>
            </div>
            <style>{`
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 70% { box-shadow: 0 0 0 15px rgba(99,102,241,0); } 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); } }
            `}</style>
        </div>
    )
}

function AutoAnalysisCard({ analysis, index, onChatWithChart }) {
    const [reasoningOpen, setReasoningOpen] = useState(false)
    const { question, category, icon, priority, data, chart_config, insights, confidence } = analysis

    // Helper for quick chips based on chart type
    const getQuickChips = () => {
        const type = chart_config?.chart_type?.toLowerCase() || ''
        const baseChips = []
        if (type === 'bar' || type === 'grouped_bar') {
            baseChips.push("Show top 5 only", "Sort descending", "Show as pie chart")
        } else if (type === 'line' || type === 'area') {
            baseChips.push("Show only this year", "Show monthly average", "Zoom into last 6 months")
        } else if (type === 'pie') {
            baseChips.push("Show as bar chart", "Show exact values", "Show top 3 only")
        } else {
            baseChips.push("Show top 5 only", "Show as bar chart")
        }

        // Check for columns that look like regions/locations to add geographic chips
        const cols = analysis.data && analysis.data.length > 0 ? Object.keys(analysis.data[0]) : []
        const hasRegion = cols.some(c => c.toLowerCase().includes('region') || c.toLowerCase().includes('country') || c.toLowerCase().includes('city') || c.toLowerCase().includes('state'))
        if (hasRegion) {
            baseChips.push("Filter to East only", "Compare North vs South")
        }

        return baseChips.slice(0, 3) // ensure 3 max
    }

    const priorityColors = {
        1: 'var(--accent-primary)',
        2: 'var(--accent-cyan)',
        3: 'var(--accent-green)',
        4: 'var(--accent-amber)',
        5: 'var(--accent-red)'
    }

    const categoryColors = {
        ranking: 'var(--accent-amber)',
        trend: 'var(--accent-cyan)',
        anomaly: 'var(--accent-red)',
        comparison: '#a855f7',
        breakdown: 'var(--accent-green)'
    }

    const priorityColor = priorityColors[priority] || priorityColors[3]
    const categoryColor = categoryColors[category?.toLowerCase()] || categoryColors.breakdown

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.15, type: 'spring', stiffness: 100, damping: 15 }}
            className="glass-card"
            style={{
                borderLeft: `3px solid ${priorityColor}`,
                display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden'
            }}
        >
            <div style={{ padding: '20px', flex: 1 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, padding: '2px 8px', background: 'rgba(99,102,241,0.2)', borderRight: '1px solid rgba(99,102,241,0.4)', borderBottom: '1px solid rgba(99,102,241,0.4)', borderBottomRightRadius: '8px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--accent-primary)' }}>
                    🤖 AUTO
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '12px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                        {icon} {question}
                    </h3>
                    <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: `${categoryColor}22`, color: categoryColor, border: `1px solid ${categoryColor}44`, textTransform: 'capitalize' }}>
                        {category}
                    </div>
                </div>

                <div style={{ minHeight: '200px' }}>
                    <ChartRenderer data={data} config={chart_config} compact={true} />
                </div>

                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {insights?.slice(0, 2).map((ins, i) => (
                        <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                            <span style={{ color: 'var(--accent-cyan)' }}>•</span> {ins}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
                <button
                    onClick={() => setReasoningOpen(!reasoningOpen)}
                    style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                >
                    <span>🧠 Agent Reasoning {reasoningOpen ? '▼' : '▶'}</span>
                    <span>{confidence}% conf</span>
                </button>
                {reasoningOpen && (
                    <div style={{ padding: '0 16px 12px 16px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        I chose this question because {category}-type analysis reveals critical business performance metrics that executives need to monitor daily. The SQL generated and chart selected reflect the most effective visualization for this data shape.
                    </div>
                )}

                {/* Actions row: View SQL and Chat */}
                <div style={{ display: 'flex', padding: '12px 16px', borderTop: '1px solid var(--glass-border)', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={() => onChatWithChart({ ...analysis })}
                        style={{
                            background: 'transparent', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '6px',
                            color: 'var(--accent-cyan)', padding: '4px 10px', fontSize: '11px', fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                        💬 Chat about this
                    </button>
                    <button className="icon-btn" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                        {'< >'} View SQL
                    </button>
                </div>

                {/* Quick Action Chips */}
                <div style={{ padding: '0 16px 12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {getQuickChips().map((chip, i) => (
                        <button key={i}
                            onClick={() => {
                                onChatWithChart({ ...analysis, quickAction: chip })
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
                                borderRadius: '20px', padding: '3px 10px', fontSize: '10px', color: 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            </div>
        </motion.div>
    )
}

export default function AutoAnalysis({ analyses, onRefresh, onHide }) {
    if (!analyses || analyses.length === 0) return null

    // Helper to format time ago
    const getTimeAgo = () => {
        return 'Just now'
    }

    return (
        <div style={{ marginBottom: '40px' }}>
            {/* Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, margin: 0, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        🤖 AI Auto-Analysis
                    </h2>
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                        Generated {getTimeAgo()}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onRefresh} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', gap: '6px' }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button onClick={onHide} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', gap: '6px' }}>
                        <EyeOff size={14} /> Hide
                    </button>
                </div>
            </div>

            {/* Gradient Divider */}
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent-primary), var(--accent-cyan), transparent)', marginBottom: '24px', opacity: 0.5 }} />

            {/* Grid */}
            <div className="dashboard-grid">
                {analyses.map((analysis, idx) => (
                    <AutoAnalysisCard key={idx} index={idx} analysis={analysis} onChatWithChart={analysis.onChatWithChart || onHide} />
                ))}
            </div>
        </div>
    )
}
