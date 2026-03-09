import React, { useState, useEffect } from 'react'
import { RefreshCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import DataUploader from './DataUploader'

export default function DatasetSwitcher({ activeTable, onSwitch }) {
    const [tables, setTables] = useState([])
    const [loading, setLoading] = useState(true)
    const [showUploader, setShowUploader] = useState(false)

    const fetchTables = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/tables')
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
            overflowY: 'auto',
            zIndex: 50
        }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 8px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                        🗄️ Datasets
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
                    Click to switch active dataset
                </div>
            </div>

            {/* List */}
            <div style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
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
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Upload a CSV below to get started</div>
                        <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '8px' }}>↓</div>
                    </div>
                ) : (
                    tables.map(table => {
                        const isActive = activeTable === table.name
                        return (
                            <motion.div
                                key={table.name}
                                animate={{ scale: 1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    onSwitch(table.name)
                                }}
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    marginBottom: '6px',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                                    border: isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                                    boxShadow: isActive ? '0 0 16px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
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
                                        background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-cyan))'
                                    }} />
                                )}

                                {/* Row 1: Title */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{getIcon(table.name)}</span>
                                        <span>{formatName(table.name)}</span>
                                    </div>
                                    {isActive && (
                                        <div style={{
                                            background: 'rgba(99,102,241,0.2)',
                                            color: 'var(--accent-primary)',
                                            fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                                            padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.4)',
                                        }}>
                                            ACTIVE
                                        </div>
                                    )}
                                </div>

                                {/* Row 2: Stats */}
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                    {table.row_count} rows • {table.col_count} cols
                                </div>

                                {/* Row 3: Chips */}
                                <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {table.preview_cols?.map(col => (
                                        <div key={col} style={{
                                            background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px',
                                            fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace'
                                        }}>
                                            {col}
                                        </div>
                                    ))}
                                    {table.col_count > 3 && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '1px 6px',
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

            {/* Bottom Section */}
            <div style={{ padding: '8px 16px 16px 16px' }}>
                <div style={{ height: '1px', background: 'var(--glass-border)', margin: '8px 0' }} />
                {!showUploader ? (
                    <button
                        onClick={() => setShowUploader(true)}
                        style={{
                            width: '100%',
                            border: '1px dashed var(--glass-border)',
                            background: 'transparent',
                            borderRadius: '10px',
                            padding: '10px',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                        📤 Upload CSV / Excel
                    </button>
                ) : (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' }}>
                            <button onClick={() => setShowUploader(false)} className="btn-ghost" style={{ fontSize: '10px', padding: '2px 6px' }}>Close</button>
                        </div>
                        <div style={{ padding: '0 8px 8px 8px' }}>
                            {/* Reusing existing DataUploader via embedding its logic, or just a compact wrapper.
                                 Since DataUploader has a wide UI out of the box, we inject it here. It scales down responsively. */}
                            <DataUploader
                                activeDatasets={[]}
                                setActiveDatasets={() => { }}
                                setDatasetContext={() => { }}
                                onUploadSuccess={(data) => {
                                    setShowUploader(false)
                                    fetchTables()
                                    onSwitch(data.table)
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
