import { useState, useRef } from 'react'
import Papa from 'papaparse'

const API_URL = '/api'

const TYPE_ICONS = { NUMERIC: '🔢', TEXT: '🔤', DATE: '📅' }
const TYPE_COLORS = { NUMERIC: 'rgba(245,158,11,0.2)', TEXT: 'rgba(6,182,212,0.2)', DATE: 'rgba(99,102,241,0.2)' }

export default function UploadPanel({ onUploadSuccess }) {
    const [activeTab, setActiveTab] = useState('csv')
    const [uploadState, setUploadState] = useState('idle')
    const [progress, setProgress] = useState(0)
    const [errorMsg, setErrorMsg] = useState('')
    const [uploadResult, setUploadResult] = useState(null)

    // File preview
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewData, setPreviewData] = useState(null)
    const [isDragging, setIsDragging] = useState(false)

    // Sheets
    const [sheetsUrl, setSheetsUrl] = useState('')
    const [showInfo, setShowInfo] = useState(false)

    const csvInputRef = useRef(null)
    const excelInputRef = useRef(null)

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const resetState = () => {
        setUploadState('idle')
        setSelectedFile(null)
        setPreviewData(null)
        setProgress(0)
        setErrorMsg('')
        setUploadResult(null)
        setSheetsUrl('')
        if (csvInputRef.current) csvInputRef.current.value = ''
        if (excelInputRef.current) excelInputRef.current.value = ''
    }

    // ── File Selection ──
    const handleFileSelect = (file, type) => {
        const allowedCsv = ['.csv']
        const allowedExcel = ['.xlsx', '.xls']
        const allowed = type === 'csv' ? allowedCsv : allowedExcel
        const ext = '.' + file.name.split('.').pop().toLowerCase()

        if (!allowed.includes(ext)) {
            setErrorMsg(`Only ${allowed.join(', ')} files are supported`)
            setUploadState('error')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            setErrorMsg('File too large (max 10MB)')
            setUploadState('error')
            return
        }

        setSelectedFile(file)
        setErrorMsg('')

        if (type === 'csv') {
            Papa.parse(file, {
                header: true,
                preview: 4,
                complete: (r) => {
                    setPreviewData({ fields: r.meta.fields, rows: r.data })
                    setUploadState('previewing')
                }
            })
        } else {
            setPreviewData(null)
            setUploadState('previewing')
        }
    }

    const handleCsvSelect = (e) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelect(file, 'csv')
    }

    const handleExcelSelect = (e) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelect(file, 'excel')
    }

    // ── Drag & Drop ──
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e, type) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFileSelect(file, type)
    }

    // ── Upload File (CSV / Excel) ──
    const uploadFile = () => {
        if (!selectedFile) return
        setUploadState('uploading')
        setProgress(0)

        const formData = new FormData()
        formData.append('file', selectedFile)
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                setProgress(Math.round(e.loaded / e.total * 100))
            }
        })

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText)
                if (xhr.status === 200 && data.success) {
                    setUploadResult(data)
                    setUploadState('success')
                    if (onUploadSuccess) onUploadSuccess(data)
                } else {
                    setErrorMsg(data.detail || data.message || 'Upload failed')
                    setUploadState('error')
                }
            } catch {
                setErrorMsg('Failed to parse server response')
                setUploadState('error')
            }
        }

        xhr.onerror = () => {
            setErrorMsg('Network error. Is the backend running?')
            setUploadState('error')
        }

        xhr.open('POST', `${API_URL}/upload-csv`)
        xhr.send(formData)
    }

    // ── Import Google Sheets ──
    const isValidSheetsUrl = sheetsUrl.includes('docs.google.com/spreadsheets')

    const importSheets = async () => {
        if (!isValidSheetsUrl) return
        setUploadState('uploading')
        setProgress(-1) // indeterminate

        try {
            const res = await fetch(`${API_URL}/import-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sheetsUrl })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setUploadResult(data)
                setUploadState('success')
                if (onUploadSuccess) onUploadSuccess(data)
            } else {
                setErrorMsg(data.detail || data.message || 'Import failed')
                setUploadState('error')
            }
        } catch {
            setErrorMsg('Network error. Is the backend running?')
            setUploadState('error')
        }
    }

    // ── Suggestion Click ──
    const handleSuggestionClick = (q) => {
        const evt = new CustomEvent('neuralbi-suggestion', { detail: { text: q } })
        window.dispatchEvent(evt)
    }

    // ── SHARED STATES ──
    if (uploadState === 'uploading') {
        return (
            <div className="upload-panel">
                <div className="upload-panel-header">📤 Add Dataset</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: '12px' }}>
                    <div className="upload-spinner" />
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Uploading {selectedFile?.name || 'sheet'}...
                    </div>
                    <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        {progress >= 0 ? (
                            <div style={{ width: `${progress}%`, height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-cyan))', transition: 'width 0.3s ease' }} />
                        ) : (
                            <div className="upload-progress-indeterminate" />
                        )}
                    </div>
                    {progress >= 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{progress}%</div>}
                </div>
            </div>
        )
    }

    if (uploadState === 'success' && uploadResult) {
        const cols = uploadResult.columns || []
        const shown = cols.slice(0, 5)
        const rest = cols.length - 5
        return (
            <div className="upload-panel">
                <div className="upload-panel-header">📤 Add Dataset</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', gap: '10px' }}>
                    <div style={{ fontSize: '28px', color: 'var(--accent-green)' }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent-green)' }}>
                        {uploadResult.table_name || uploadResult.table} loaded!
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {uploadResult.row_count || uploadResult.rows} rows • {uploadResult.col_count || (Array.isArray(uploadResult.columns) ? uploadResult.columns.length : uploadResult.columns)} columns
                    </div>

                    {shown.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                            {shown.map(c => (
                                <span key={c.name} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: TYPE_COLORS[c.type] || 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {TYPE_ICONS[c.type] || ''} {c.name}
                                </span>
                            ))}
                            {rest > 0 && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>+{rest} more</span>}
                        </div>
                    )}

                    {uploadResult.suggested_questions?.length > 0 && (
                        <div style={{ width: '100%', marginTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>💡 Try asking:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {uploadResult.suggested_questions.map((q, i) => (
                                    <div key={i} onClick={() => handleSuggestionClick(q)} className="upload-suggestion-chip">{q}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={resetState} className="btn-ghost" style={{ fontSize: '12px', marginTop: '6px', padding: '6px 14px' }}>Upload Another</button>
                </div>
            </div>
        )
    }

    if (uploadState === 'error') {
        return (
            <div className="upload-panel">
                <div className="upload-panel-header">📤 Add Dataset</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: '10px' }}>
                    <div style={{ fontSize: '24px', color: 'var(--accent-red)' }}>❌</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-red)' }}>Upload Failed</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' }}>{errorMsg}</div>
                    <button onClick={resetState} className="btn-ghost" style={{ fontSize: '12px', marginTop: '4px', padding: '6px 14px' }}>Try Again</button>
                </div>
            </div>
        )
    }

    // ── PREVIEWING STATE (CSV / Excel) ──
    if (uploadState === 'previewing' && selectedFile) {
        return (
            <div className="upload-panel">
                <div className="upload-panel-header">📤 Add Dataset</div>
                <div style={{ padding: '12px' }}>
                    <div className="upload-preview-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px' }}>{activeTab === 'csv' ? '📄' : '📊'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatSize(selectedFile.size)}</div>
                            </div>
                            <button onClick={resetState} className="btn-ghost" style={{ padding: '2px 6px', fontSize: '14px', lineHeight: 1 }}>✕</button>
                        </div>

                        {previewData ? (
                            <div style={{ marginTop: '10px', maxHeight: '100px', overflow: 'auto', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                                <table className="upload-preview-table">
                                    <thead>
                                        <tr>
                                            {previewData.fields.map(f => <th key={f}>{f}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.rows.map((row, i) => (
                                            <tr key={i}>
                                                {previewData.fields.map(f => <td key={f}>{row[f]}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                                Preview not available for Excel<br />File will be loaded on upload
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button onClick={uploadFile} className="upload-confirm-btn" style={{ flex: 1 }}>✅ Upload</button>
                            <button onClick={resetState} className="btn-ghost" style={{ flex: 1, fontSize: '12px' }}>✕ Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ── IDLE STATE — TAB CONTENT ──
    return (
        <div className="upload-panel">
            <div className="upload-panel-header">📤 Add Dataset</div>

            {/* Tab Switcher */}
            <div className="upload-tabs">
                {['csv', 'excel', 'sheets'].map(tab => (
                    <div key={tab} className={`upload-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => { setActiveTab(tab); resetState() }}>
                        {tab === 'csv' ? '📄 CSV' : tab === 'excel' ? '📊 Excel' : '🔗 Sheets'}
                    </div>
                ))}
            </div>

            {/* CSV Tab */}
            {activeTab === 'csv' && (
                <div style={{ padding: '8px' }}>
                    <div
                        className={`upload-drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'csv')}
                        onClick={() => csvInputRef.current?.click()}
                    >
                        <div style={{ fontSize: '24px', color: isDragging ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>📄</div>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                            {isDragging ? 'Release to upload' : 'Drop CSV here'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>or click to browse</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>Max 10MB</div>
                    </div>
                    <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvSelect} />
                </div>
            )}

            {/* Excel Tab */}
            {activeTab === 'excel' && (
                <div style={{ padding: '8px' }}>
                    <div
                        className={`upload-drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'excel')}
                        onClick={() => excelInputRef.current?.click()}
                    >
                        <div style={{ fontSize: '24px', color: isDragging ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>📊</div>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                            {isDragging ? 'Release to upload' : 'Drop Excel here'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>or click to browse</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>.xlsx and .xls supported</div>
                    </div>
                    <input ref={excelInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelSelect} />
                </div>
            )}

            {/* Sheets Tab */}
            {activeTab === 'sheets' && (
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', color: 'var(--accent-cyan)' }}>🔗</div>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}>Paste Google Sheets URL</div>
                    </div>

                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
                        Make sure your sheet is set to:<br /><strong style={{ color: 'var(--text-secondary)' }}>Anyone with the link → can view</strong>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="upload-sheets-input"
                            placeholder="https://docs.google.com/spreadsheets/..."
                            value={sheetsUrl}
                            onChange={(e) => setSheetsUrl(e.target.value)}
                            style={{
                                borderColor: sheetsUrl.length > 10
                                    ? (isValidSheetsUrl ? 'var(--accent-green)' : 'var(--accent-red)')
                                    : undefined
                            }}
                        />
                        {sheetsUrl.length > 10 && (
                            <div style={{
                                fontSize: '10px', marginTop: '4px', fontWeight: 500,
                                color: isValidSheetsUrl ? 'var(--accent-green)' : 'var(--accent-red)'
                            }}>
                                {isValidSheetsUrl ? '✓ Valid Sheets URL' : '✗ Not a valid Sheets URL'}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={importSheets}
                        disabled={!isValidSheetsUrl}
                        className="upload-sheets-btn"
                    >
                        Import Sheet
                    </button>

                    <div>
                        <button onClick={() => setShowInfo(!showInfo)} className="btn-ghost" style={{ fontSize: '11px', padding: '4px 0', color: 'var(--text-muted)', width: '100%', textAlign: 'left' }}>
                            ℹ️ How does this work?
                        </button>
                        {showInfo && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', marginTop: '4px' }}>
                                NeuralBI fetches your sheet as CSV, loads it into the database, and lets you query it with natural language.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
