import React, { useState, useEffect } from 'react'
import { RefreshCcw, Check } from 'lucide-react'
import { motion } from 'framer-motion'

const ACCENT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']

export default function DatasetSwitcher({ activeTables = [], onToggle, tablesMeta }) {
    const [tables, setTables] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchTables = async () => {
        setLoading(true)
        try {
            const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
            const res = await fetch(`${API_URL}/tables`)
            const data = await res.json()
            setTables(data.tables || [])
        } catch (e) {
            console.error("Failed to fetch tables", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTables()
    }, [])

    // Listen for upload success to refresh list
    useEffect(() => {
        const handler = () => fetchTables()
        window.addEventListener('neuralbi-dataset-refresh', handler)
        return () => window.removeEventListener('neuralbi-dataset-refresh', handler)
    }, [])

    const getIcon = (name) => {
        if (name === 'sales') return '💰'
        if (name === 'customers') return '👥'
        if (name === 'monthly_targets') return '🎯'
        const isUploaded = tables.find(t => t.name === name)?.is_uploaded
        if (isUploaded) return '📤'
        return '🗄️'
    }

    const formatName = (name) => {
        return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    const getAccentColor = (tableName) => {
        const idx = activeTables.indexOf(tableName)
        return idx >= 0 ? ACCENT_COLORS[idx % ACCENT_COLORS.length] : null
    }

    const allSelected = tables.length > 0 && tables.every(t => activeTables.includes(t.name))

    return (
        <div style={{
            width: '260px',
            height: 'calc(100vh - 64px)',
            top: '64px',
            left: 0,
            position: 'fixed',
            background: 'rgba(255,255,255,0.02)',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 50
        }}>
            {/* SECTION A — Scrollable dataset list */}
            <div className="dataset-scroll" style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '8px'
            }}>
                {/* Header */}
                <div style={{ padding: '8px 8px 6px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                                🗄️ Datasets
                            </span>
                            {activeTables.length > 0 && (
                                <span style={{
                                    background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)',
                                    fontSize: '10px', padding: '2px 7px', borderRadius: '10px', fontWeight: 600
                                }}>
                                    {activeTables.length} active
                                </span>
                            )}
                        </div>
                        <button
                            onClick={fetchTables}
                            className="btn-ghost"
                            title="Refresh datasets"
                            style={{ padding: '4px', borderRadius: '4px' }}
                        >
                            <RefreshCcw size={14} className={loading ? "spin" : ""} />
                        </button>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Click to toggle datasets on/off
                    </div>
                </div>

                {/* Select All / Clear All */}
                {tables.length > 0 && !loading && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 12px 6px' }}>
                        <button
                            onClick={() => {
                                if (allSelected) {
                                    tables.forEach(t => { if (activeTables.includes(t.name)) onToggle(t.name) })
                                } else {
                                    tables.forEach(t => { if (!activeTables.includes(t.name)) onToggle(t.name) })
                                }
                            }}
                            className="btn-ghost"
                            style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--accent-primary)' }}
                        >
                            {allSelected ? 'Clear All' : 'Select All'}
                        </button>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {activeTables.length} of {tables.length} selected
                        </span>
                    </div>
                )}

                {/* List */}
                <div style={{ padding: '0 4px' }}>
                    {loading ? (
                        <>
                            <div className="skeleton-card" style={{ height: '72px', borderRadius: '12px', marginBottom: '6px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                            <div className="skeleton-card" style={{ height: '72px', borderRadius: '12px', marginBottom: '6px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                            <div className="skeleton-card" style={{ height: '72px', borderRadius: '12px', marginBottom: '6px', background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                        </>
                    ) : tables.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: '40px' }}>
                            <div style={{ fontSize: '32px', opacity: 0.5 }}>🗄️</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>No datasets available</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Click "+ Add Dataset" to get started</div>
                        </div>
                    ) : (
                        tables.map(table => {
                            const isActive = activeTables.includes(table.name)
                            const accent = getAccentColor(table.name)
                            return (
                                <motion.div
                                    key={table.name}
                                    animate={{ scale: 1 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onToggle(table.name)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        marginBottom: '4px',
                                        transition: 'all 0.2s ease',
                                        position: 'relative',
                                        background: isActive ? `${accent}1F` : 'transparent',
                                        border: isActive ? `1px solid ${accent}80` : '1px solid transparent',
                                        boxShadow: isActive ? `0 0 16px ${accent}26` : 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                            e.currentTarget.style.border = '1px solid var(--glass-border)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.border = '1px solid transparent'
                                        }
                                    }}
                                >
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute', left: 0, top: 0, height: '100%', width: '3px',
                                            borderRadius: '3px 0 0 3px',
                                            background: accent
                                        }} />
                                    )}

                                    {/* Checkmark badge */}
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute', top: '6px', right: '6px',
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: accent, color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px'
                                        }}>
                                            <Check size={11} />
                                        </div>
                                    )}

                                    {/* Row 1: Title */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: isActive ? '22px' : 0 }}>
                                        <span style={{ fontSize: '14px' }}>{getIcon(table.name)}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {formatName(table.name)}
                                        </span>
                                    </div>

                                    {/* Row 2: Stats */}
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {table.row_count} rows • {table.col_count} cols
                                    </div>

                                    {/* Row 3: Chips */}
                                    <div style={{ marginTop: '5px', display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                        {table.preview_cols?.map(col => (
                                            <div key={col} style={{
                                                background: 'rgba(255,255,255,0.06)', borderRadius: '3px', padding: '1px 5px',
                                                fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace'
                                            }}>
                                                {col}
                                            </div>
                                        ))}
                                        {table.col_count > 3 && (
                                            <div style={{
                                                background: 'rgba(255,255,255,0.06)', borderRadius: '3px', padding: '1px 5px',
                                                fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace'
                                            }}>
                                                +{table.col_count - 3} more
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Tag */}
                                    <div style={{ textAlign: 'right', marginTop: '4px' }}>
                                        <span style={{
                                            fontSize: '10px',
                                            color: table.is_uploaded ? 'var(--accent-green)' : 'var(--text-muted)',
                                        }}>
                                            {table.is_uploaded ? 'Uploaded' : 'Built-in'}
                                        </span>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
