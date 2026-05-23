import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function DatasetOverview({ activeTable, allTables, onTableSwitch }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [openSections, setOpenSections] = useState({ columns: true, stats: false, preview: false })

    useEffect(() => {
        if (!activeTable) return;
        setLoading(true)
        const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
        fetch(`${API_URL}/stats?table=${activeTable}`)
            .then(res => res.json())
            .then(data => {
                setStats(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [activeTable])

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    const handleColumnClick = (colName) => {
        const event = new CustomEvent('appendToQuery', { detail: { text: colName } });
        window.dispatchEvent(event);
    }

    if (loading || !stats) {
        return <div className="dataset-overview" style={{ marginTop: '24px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading stats...</div>
    }

    return (
        <div className="dataset-overview" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* SECTION 1 - Active Table Badge */}
            <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', animation: 'blink 2s infinite' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.table} • {stats.row_count} rows</span>
            </div>

            {/* SECTION 2 - Table Switcher */}
            {allTables && allTables.length > 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Table:</label>
                    <select
                        value={activeTable}
                        onChange={(e) => onTableSwitch(e.target.value)}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 12px', outline: 'none' }}
                    >
                        {allTables.map(t => (
                            <option key={t.name} value={t.name}>{t.name} ({t.row_count} rows)</option>
                        ))}
                    </select>
                </div>
            )}

            {/* SECTION 3 - Column Explorer */}
            <div>
                <div onClick={() => toggleSection('columns')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    {openSections.columns ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>📂 Columns</span>
                </div>
                {openSections.columns && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                        {stats.stats.map(col => (
                            <div key={col.name} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleColumnClick(col.name)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{col.name}</span>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                                        background: col.display_type === 'NUMERIC' ? 'rgba(245,158,11,0.15)' : col.display_type === 'TEXT' ? 'rgba(6,182,212,0.15)' : 'rgba(99,102,241,0.15)',
                                        color: col.display_type === 'NUMERIC' ? 'var(--accent-amber)' : col.display_type === 'TEXT' ? 'var(--accent-cyan)' : 'var(--accent-primary)'
                                    }}>
                                        {col.display_type === 'NUMERIC' ? '🔢 NUM' : col.display_type === 'TEXT' ? '🔤 TXT' : '📅 DATE'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {col.sample.slice(0, 3).join(', ')}{col.sample.length > 3 ? '...' : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 4 - Quick Stats */}
            <div>
                <div onClick={() => toggleSection('stats')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    {openSections.stats ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>📊 Stats</span>
                </div>
                {openSections.stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px' }}>
                        {stats.stats.map(col => (
                            <div key={col.name} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-primary)', marginRight: '8px' }}>{col.name}:</span>
                                {col.display_type === 'NUMERIC' && `Min: ${col.min} | Max: ${col.max} | Avg: ${col.avg}`}
                                {col.display_type === 'TEXT' && `${col.unique_count} unique values`}
                                {col.display_type === 'DATE' && `${col.min_date} → ${col.max_date}`}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 5 - Data Preview */}
            <div>
                <div onClick={() => toggleSection('preview')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    {openSections.preview ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>👁️ Preview</span>
                </div>
                {openSections.preview && (
                    <div style={{ maxHeight: '160px', overflowX: 'auto', overflowY: 'auto', background: '#0d1117', borderRadius: '8px', padding: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                            <thead>
                                <tr>
                                    {stats.preview.length > 0 && Object.keys(stats.preview[0]).map(k => (
                                        <th key={k} style={{ color: 'var(--accent-primary)', textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {stats.preview.map((row, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} style={{ padding: '4px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{String(val)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
    )
}
