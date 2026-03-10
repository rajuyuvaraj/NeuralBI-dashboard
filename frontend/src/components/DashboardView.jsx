import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, MessageSquare, Search, Maximize2, X } from 'lucide-react';
import ChartRenderer from './ChartRenderer';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DashboardView({ activeTables, onClose }) {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [filters, setFilters] = useState({});

    // Data Table State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;

    // Expand Chart Modal
    const [expandedChart, setExpandedChart] = useState(null);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tables: activeTables, dashboard_type: "auto" })
            });
            const data = await res.json();
            if (data.success) {
                setDashboardData(data);
                setFilters({});
            }
        } catch (error) {
            console.error("Failed to load dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setExpandedChart(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTables]);

    const smartFormatCell = (colName, value) => {
        if (value === null || value === undefined) return '-';
        const lowerCol = String(colName).toLowerCase();

        if (lowerCol.includes('revenue') || lowerCol.includes('price') || lowerCol.includes('cost')) {
            const num = Number(value);
            if (!isNaN(num)) {
                return (
                    <span style={{ color: num > 0 ? 'var(--accent-green)' : 'inherit' }}>{num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                );
            }
        }
        if (lowerCol.includes('date')) {
            try {
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            } catch (e) { }
        }
        if (lowerCol.includes('status') || lowerCol.includes('tier') || lowerCol.includes('type')) {
            const strValue = String(value).toLowerCase();
            let color = 'gray';
            if (['active', 'gold', 'enterprise', 'success'].some(t => strValue.includes(t))) color = 'var(--accent-green)';
            if (['churned', 'bronze', 'free', 'failed', 'inactive'].some(t => strValue.includes(t))) color = '#94a3b8';
            if (['warning', 'silver', 'pending'].some(t => strValue.includes(t))) color = 'var(--accent-amber)';

            return (
                <span style={{
                    background: `${color}20`, color: color, padding: '2px 8px',
                    borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize'
                }}>
                    {String(value)}
                </span>
            );
        }

        const num = Number(value);
        if (!isNaN(num)) {
            if (lowerCol.includes('percent') || lowerCol.includes('pct')) return `${num.toFixed(1)}%`;
            if (num > 1000) return num.toLocaleString();
        }
        return String(value);
    };

    const exportPDF = async () => {
        const pdf = new jsPDF('l', 'mm', 'a4');
        const kpiEl = document.getElementById('kpi-section');
        if (kpiEl) {
            const kpiCanvas = await html2canvas(kpiEl, { backgroundColor: '#050811', scale: 2 });
            pdf.addImage(kpiCanvas.toDataURL(), 'PNG', 10, 10, 277, (kpiCanvas.height * 277) / kpiCanvas.width);
        }
        const chartEls = document.querySelectorAll('.dashboard-chart-card');
        for (let i = 0; i < chartEls.length; i++) {
            pdf.addPage();
            const canvas = await html2canvas(chartEls[i], { backgroundColor: '#050811', scale: 2 });
            pdf.addImage(canvas.toDataURL(), 'PNG', 10, 10, 277, (canvas.height * 277) / canvas.width);
        }
        pdf.save(`NeuralBI_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Extract dynamic filters
    const filterOptions = useMemo(() => {
        if (!dashboardData?.data_table?.rows) return [];
        const rows = dashboardData.data_table.rows;
        const options = {};
        if (rows.length === 0) return [];

        const textCols = dashboardData.data_table.columns.filter(col => {
            return !rows.some(r => typeof r[col] === 'number');
        });

        textCols.forEach(col => {
            const uniqueValues = [...new Set(rows.map(r => String(r[col])))].filter(v => v !== 'null' && v !== 'undefined');
            if (uniqueValues.length > 0 && uniqueValues.length < 20) {
                options[col] = uniqueValues;
            }
        });
        return Object.entries(options);
    }, [dashboardData]);

    const handleFilterChange = (col, val) => {
        setFilters(prev => ({ ...prev, [col]: val }));
    };

    const filteredData = (data) => {
        if (!data) return [];
        return data.filter(row =>
            Object.entries(filters).every(([col, val]) =>
                val === 'all' || String(row[col]) === String(val)
            )
        );
    };

    // Table Logic
    const rawTableRows = dashboardData?.data_table?.rows || [];
    const tableCols = dashboardData?.data_table?.columns || [];

    const processedTableRows = useMemo(() => {
        let rows = filteredData(rawTableRows);
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(lowerSearch)));
        }
        if (sortCol) {
            rows.sort((a, b) => {
                const va = a[sortCol];
                const vb = b[sortCol];
                const mul = sortDir === 'asc' ? 1 : -1;
                if (!va) return 1;
                if (!vb) return -1;
                if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
                return String(va).localeCompare(String(vb)) * mul;
            });
        }
        return rows;
    }, [rawTableRows, filters, searchTerm, sortCol, sortDir]);

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return processedTableRows.slice(start, start + rowsPerPage);
    }, [processedTableRows, currentPage]);

    const totalPages = Math.ceil(processedTableRows.length / rowsPerPage) || 1;

    const handleSort = (col) => {
        if (sortCol === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
    };

    if (loading) {
        return (
            <div id="dashboard-view" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--bg-dark)', zIndex: 50, overflowY: 'auto' }}>
                <div style={{ padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="skeleton-line" style={{ width: '200px', height: '24px' }} />
                </div>
                <div style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="glass-card layout-animation" style={{ height: '120px', padding: '20px' }}>
                                <div className="skeleton-line" style={{ width: '40%', height: '16px', marginBottom: '16px' }} />
                                <div className="skeleton-line" style={{ width: '60%', height: '32px' }} />
                                <div className="skeleton-line" style={{ width: '80%', height: '12px', marginTop: '16px' }} />
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <div className="glass-card layout-animation" style={{ padding: '24px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                <div style={{ fontSize: '32px', animation: 'spin 3s linear infinite' }}>🤖</div>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Building your dashboard...</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Analyzing {activeTables.length} dataset(s)</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Running queries in parallel...</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', opacity: 0.3 }}>
                            <div className="glass-card" style={{ gridColumn: 'span 2', height: '300px' }} />
                            <div className="glass-card" style={{ gridColumn: 'span 2', height: '300px' }} />
                            <div className="glass-card" style={{ gridColumn: 'span 1', height: '200px' }} />
                            <div className="glass-card" style={{ gridColumn: 'span 1', height: '200px' }} />
                            <div className="glass-card" style={{ gridColumn: 'span 1', height: '200px' }} />
                            <div className="glass-card" style={{ gridColumn: 'span 1', height: '200px' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="dashboard-view" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--bg-dark)', zIndex: 50, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ height: '56px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40, backdropFilter: 'blur(12px)' }}>
                <div>
                    <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 700, margin: 0, background: 'linear-gradient(to right, #e2e8f0, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {dashboardData?.dashboard_title || 'Auto Dashboard'}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{dashboardData?.subtitle}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'center' }}>
                    {activeTables.map((t, i) => {
                        const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
                        const color = colors[i % colors.length];
                        return (
                            <span key={i} style={{ background: `${color}20`, border: `1px solid ${color}50`, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', color: color, fontWeight: 600 }}>
                                {t}
                            </span>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }}>
                        Generated {new Date(dashboardData?.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ago
                    </span>
                    <button className="btn-ghost" onClick={loadDashboard} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', gap: '6px' }}><RefreshCw size={14} /> Regenerate</button>
                    <button className="btn-ghost" onClick={exportPDF} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', gap: '6px' }}><Download size={14} /> Export PDF</button>
                    <button className="btn-ghost" onClick={onClose} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', gap: '6px', color: 'var(--accent-red)' }}><MessageSquare size={14} /> Back to Chat</button>
                </div>
            </div>

            {/* Filter Bar */}
            {filterOptions.length > 0 && (
                <div style={{ padding: '10px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--glass-border)' }}>
                    {filterOptions.map(([col, values]) => (
                        <select
                            key={col}
                            value={filters[col] || 'all'}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                        >
                            <option value="all">All {col.replace(/_/g, ' ')}</option>
                            {values.map(val => (
                                <option key={val} value={val}>{val}</option>
                            ))}
                        </select>
                    ))}
                    {Object.values(filters).some(v => v !== 'all') && (
                        <button className="btn-ghost" onClick={() => setFilters({})} style={{ fontSize: '12px', color: 'var(--accent-red)', padding: '6px 12px' }}>Clear All Filters</button>
                    )}
                </div>
            )}

            <div style={{ padding: '24px' }}>
                <div id="kpi-section" style={{ paddingBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        {dashboardData?.kpis?.map((kpi, idx) => (
                            <motion.div
                                key={kpi.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass-card"
                                style={{ padding: '20px 24px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}
                            >
                                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `var(--accent-${kpi.color || 'primary'})`, opacity: 0.15, filter: 'blur(20px)', pointerEvents: 'none' }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {kpi.title}
                                    </span>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(var(--accent-${kpi.color || 'primary'}-rgb, 99, 102, 241), 0.15)`, border: `1px solid rgba(var(--accent-${kpi.color || 'primary'}-rgb, 99, 102, 241), 0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                        {kpi.icon}
                                    </div>
                                </div>

                                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 4px 0' }}>
                                    {kpi.formatted_value}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {kpi.trend_direction === 'up' && <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>↑ {kpi.trend_percent}%</span>}
                                        {kpi.trend_direction === 'down' && <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>↓ {kpi.trend_percent}%</span>}
                                        {kpi.trend_direction === 'flat' && <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600 }}>→ 0%</span>}
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{kpi.trend_label}</span>
                                    </div>
                                </div>

                                {kpi.trend_percent > 0 && (
                                    <div style={{ width: '100%', height: '40px', marginTop: '12px', marginLeft: '-10px', marginRight: '-10px' }}>
                                        <ResponsiveContainer width="110%" height="100%">
                                            <LineChart data={[{ v: kpi.trend_direction === 'up' ? 0 : 10 }, { v: kpi.trend_direction === 'up' ? kpi.trend_percent : 0 }]}>
                                                <Line type="monotone" dataKey="v" stroke={kpi.trend_direction === 'up' ? 'var(--accent-green)' : 'var(--accent-red)'} strokeWidth={2} dot={false} isAnimationActive={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    {dashboardData?.charts?.map((chart, idx) => (
                        <motion.div
                            key={chart.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1, type: 'spring', stiffness: 100 }}
                            className="glass-card dashboard-chart-card"
                            style={{
                                padding: '16px 20px', borderRadius: '16px',
                                gridColumn: chart.size === 'large' ? 'span 2' : chart.size === 'medium' ? 'span 2' : 'span 1'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, margin: '0 0 4px 0' }}>{chart.title}</h3>
                                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>{chart.insight}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', fontSize: '10px', color: 'var(--text-secondary)' }}>{chart.chart_type}</span>
                                    <button className="icon-btn" onClick={() => setExpandedChart(chart)} title="Expand"><Maximize2 size={14} /></button>
                                </div>
                            </div>
                            <div style={{ height: chart.size === 'large' ? '300px' : chart.size === 'medium' ? '260px' : '200px' }}>
                                <ChartRenderer data={filteredData(chart.data)} config={{ ...chart }} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontFamily: 'Space Grotesk, sans-serif' }}>{dashboardData?.data_table?.title || 'Data View'}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="🔍 Search..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '6px 12px 6px 32px', color: 'white', fontSize: '12px', outline: 'none', width: '200px' }}
                                />
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '12px' }}>{processedTableRows.length} rows</span>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    {tableCols.map(col => (
                                        <th key={col} onClick={() => handleSort(col)} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                            {col.replace(/_/g, ' ')}
                                            {sortCol === col && (
                                                <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.length > 0 ? paginatedRows.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: '0.15s' }}>
                                        {tableCols.map(col => (
                                            <td key={col} style={{ padding: '9px 14px', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                {smartFormatCell(col, row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr><td colSpan={tableCols.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No records found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Showing {processedTableRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, processedTableRows.length)} of {processedTableRows.length} rows
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '8px' }}>← Prev</button>
                            <span style={{ display: 'flex', gap: '4px' }}>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage > 3 && totalPages > 5 ? currentPage - 2 + i : i + 1;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage > totalPages - 2) pageNum = totalPages - 4 + i;

                                    if (pageNum > totalPages) return null;

                                    return (
                                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px', background: currentPage === pageNum ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)', border: 'none', color: 'white', cursor: 'pointer' }}>
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </span>
                            <button className="btn-ghost" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '8px' }}>Next →</button>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {expandedChart && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}
                        onClick={() => setExpandedChart(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card"
                            style={{ width: '100%', maxWidth: '1200px', padding: '24px', borderRadius: '24px', position: 'relative' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button className="icon-btn" onClick={() => setExpandedChart(null)} style={{ position: 'absolute', top: '24px', right: '24px' }}><X size={20} /></button>
                            <h2 style={{ margin: '0 0 8px 0', fontFamily: 'Space Grotesk, sans-serif' }}>{expandedChart.title}</h2>
                            <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)' }}>{expandedChart.insight}</p>
                            <div style={{ height: '70vh' }}>
                                <ChartRenderer data={filteredData(expandedChart.data)} config={{ ...expandedChart }} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
