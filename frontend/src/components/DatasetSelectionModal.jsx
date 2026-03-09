import React, { useState, useEffect } from 'react'
import { X, Database, Search, Check, Target } from 'lucide-react'

export default function DatasetSelectionModal({
    isOpen,
    onClose,
    onSave,
    initialDatasets = [],
    initialFocus = "Full Overview",
    availableTables = [],
    mode = "switch" // 'switch' or 'add'
}) {
    const [selected, setSelected] = useState([])
    const [focus, setFocus] = useState("")
    const [step, setStep] = useState(1) // 1: Select Tables, 2: Focus Area

    useEffect(() => {
        if (isOpen) {
            if (mode === 'add') {
                setSelected([...initialDatasets])
            } else {
                setSelected([]) // empty for switch
            }
            setFocus(initialFocus === "General Overview" ? "Full Overview" : initialFocus)
            setStep(1)
        }
    }, [isOpen, initialDatasets, initialFocus, mode])

    if (!isOpen) return null

    const toggleTable = (t) => {
        if (selected.includes(t)) {
            setSelected(selected.filter(x => x !== t))
        } else {
            setSelected([...selected, t])
        }
    }

    const handleNext = () => setStep(2)

    const handleSave = () => {
        onSave({
            tables: selected,
            focus: focus || "Full Overview"
        })
        onClose()
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 8, 17, 0.85)', backdropFilter: 'blur(10px)',
            zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="glass-card layout-animation" style={{
                width: '100%', maxWidth: '500px',
                background: '#0a101d', border: '1px solid var(--glass-border)',
                borderRadius: '16px', overflow: 'hidden'
            }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {step === 1 ? <><Database size={20} className="text-accent" /> {mode === 'add' ? 'Add Datasets' : 'Select Datasets'}</> : <><Target size={20} className="text-secondary" /> Focus Area</>}
                    </h2>
                    <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '24px' }}>
                    {step === 1 ? (
                        <>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                                Choose which data tables the AI should analyze for this session.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                {availableTables.map(t => (
                                    <div
                                        key={t.name}
                                        onClick={() => toggleTable(t.name)}
                                        style={{
                                            padding: '12px 16px', borderRadius: '8px',
                                            background: selected.includes(t.name) ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${selected.includes(t.name) ? 'var(--accent-primary)' : 'transparent'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer', transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '20px', height: '20px', borderRadius: '4px',
                                                border: '1px solid var(--text-muted)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: selected.includes(t.name) ? 'var(--accent-primary)' : 'transparent',
                                                borderColor: selected.includes(t.name) ? 'var(--accent-primary)' : 'var(--text-muted)'
                                            }}>
                                                {selected.includes(t.name) && <Check size={14} color="white" />}
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{t.name}</span>
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.row_count} rows</span>
                                    </div>
                                ))}
                                {availableTables.length === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                        No tables found. Please upload a dataset first.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                                What should the AI focus on? This helps frame the narrative reports and auto-analysis.
                            </p>
                            <input
                                type="text"
                                className="terminal-input"
                                value={focus}
                                onChange={(e) => setFocus(e.target.value)}
                                placeholder="e.g. Revenue & Growth, Sales Team Performance..."
                                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                                {["Full Overview", "Revenue & Sales", "Customer Retention", "Product Performance"].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setFocus(tag)}
                                        className="btn-ghost"
                                        style={{
                                            padding: '4px 10px', fontSize: '12px',
                                            background: focus === tag ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${focus === tag ? 'var(--accent-cyan)' : 'transparent'}`,
                                            color: focus === tag ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    {step === 2 && (
                        <button className="btn-ghost" onClick={() => setStep(1)} style={{ marginRight: 'auto' }}>Back</button>
                    )}
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    {step === 1 ? (
                        <button
                            className="btn-primary"
                            disabled={selected.length === 0}
                            onClick={handleNext}
                            style={{ opacity: selected.length === 0 ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    ) : (
                        <button className="btn-primary" onClick={handleSave}>
                            Save & Apply
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
