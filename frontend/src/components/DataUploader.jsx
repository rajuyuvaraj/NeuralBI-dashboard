import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Trash2, ArrowRight } from 'lucide-react'
import Papa from 'papaparse'
import DatasetOverview from './DatasetOverview'

import { Link } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export default function DataUploader({ activeDatasets, setActiveDatasets, setDatasetContext, onUploadSuccess }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [sheetUrl, setSheetUrl] = useState('')
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadResult, setUploadResult] = useState(null)
    const [uploadError, setUploadError] = useState(null)
    const [tables, setTables] = useState([])
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewRows, setPreviewRows] = useState([])
    const [previewCols, setPreviewCols] = useState([])
    const fileInputRef = useRef(null)

    const fetchTables = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/tables`)
            const data = await res.json()
            setTables(data.tables || [])
        } catch (e) {
            console.error('Failed to fetch tables:', e)
        }
    }, [])

    useEffect(() => {
        fetchTables()
    }, [fetchTables])

    const handleToggle = () => {
        setIsOpen(!isOpen)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelectInternal(file)
    }

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) handleFileSelectInternal(file)
    }

    const handleFileSelectInternal = (file) => {
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setUploadError('Only CSV and Excel files are supported')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File size exceeds 10MB limit')
            return
        }
        setUploadError(null)
        setUploadResult(null)
        setSelectedFile(file)

        if (file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                preview: 5,
                complete: (results) => {
                    setPreviewRows(results.data)
                    setPreviewCols(results.meta.fields)
                }
            })
        } else {
            setPreviewRows([])
            setPreviewCols([])
        }
    }

    const cancelSelection = () => {
        setSelectedFile(null)
        setPreviewRows([])
        setPreviewCols([])
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const uploadWithProgress = (file) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            const formData = new FormData()
            formData.append('file', file)

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100)
                    setUploadProgress(pct)
                }
            })

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText)
                        if (data.success) {
                            setActiveDatasets([data.table])
                            if (setDatasetContext) setDatasetContext({ tables: [data.table], focus: "Full Overview", set_at: new Date().toISOString() })
                        }
                        resolve(data)
                    } catch (e) {
                        reject({ error: 'Failed to parse response', details: e.message })
                    }
                } else {
                    reject(JSON.parse(xhr.responseText))
                }
            }

            xhr.onerror = () => reject({ error: 'Network error' })
            xhr.open('POST', `${API_URL}/upload-csv`)
            xhr.send(formData)
        })
    }

    const confirmUpload = async () => {
        if (!selectedFile) return
        setUploading(true)
        setUploadProgress(0)
        setUploadError(null)

        try {
            const data = await uploadWithProgress(selectedFile)
            if (data.success) {
                setUploadResult(data)
                fetchTables()
                setSelectedFile(null)
                if (onUploadSuccess) onUploadSuccess(data)
                setActiveDatasets([data.table])
                if (setDatasetContext) setDatasetContext({ tables: [data.table], focus: "Full Overview", set_at: new Date().toISOString() })
            } else {
                setUploadError(data.message || 'Upload failed')
            }
        } catch (e) {
            setUploadError(e.message || 'Network error: Could not reach backend')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const importGoogleSheet = async () => {
        if (!sheetUrl.trim()) return
        setUploading(true)
        setUploadProgress(0)
        setUploadError(null)
        setUploadResult(null)

        try {
            // Fake progress for visual feedback
            const interval = setInterval(() => setUploadProgress(p => p < 90 ? p + 10 : p), 200)

            const res = await fetch(`${API_URL}/import-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sheetUrl })
            })
            const data = await res.json()

            clearInterval(interval)
            setUploadProgress(100)

            if (data.success) {
                setUploadResult(data)
                fetchTables()
                setSheetUrl('')
                if (onUploadSuccess) onUploadSuccess(data)
                setActiveDatasets([data.table])
                if (setDatasetContext) setDatasetContext({ tables: [data.table], focus: "Full Overview", set_at: new Date().toISOString() })
            } else {
                setUploadError(data.message || 'Import failed')
            }
        } catch (e) {
            setUploadError('Network error: Could not reach backend')
        } finally {
            setTimeout(() => {
                setUploading(false)
                setUploadProgress(0)
            }, 500)
        }
    }

    const removeTable = async (tableName) => {
        try {
            const res = await fetch(`${API_URL}/table/${tableName}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) {
                fetchTables()
                if (activeDatasets.includes(tableName)) {
                    const remainingTables = tables.filter(t => t.name !== tableName)
                    if (remainingTables.length > 0) {
                        setActiveDatasets([remainingTables[0].name])
                        if (setDatasetContext) setDatasetContext({ tables: [remainingTables[0].name], focus: "Full Overview", set_at: new Date().toISOString() })
                    } else {
                        setActiveDatasets([])
                        if (setDatasetContext) setDatasetContext(null)
                    }
                }
            } else {
                setUploadError(data.message)
            }
        } catch (e) {
            setUploadError('Failed to delete table')
        }
    }

    const appendToQuery = (text) => {
        window.dispatchEvent(new CustomEvent('appendToQuery', { detail: { text } }))
    }

    return (
        <>
            <button
                className={`uploader-toggle ${isOpen ? 'shifted' : ''}`}
                onClick={handleToggle}
            >
                DATA
            </button>

            <div className={`data-uploader ${isOpen ? '' : 'collapsed'}`}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    📊 Data Sources
                </h3>

                {/* Drop Zone */}
                {!selectedFile && !uploading && !uploadResult && (
                    <>
                        <div
                            className={`drop-zone ${isDragging ? 'drag-over' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleFileSelect} />
                            <div className="drop-zone-icon">☁️</div>
                            <p>Drop CSV or Excel file here</p>
                            <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted)' }}>Max 10MB</p>
                        </div>

                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)' }}>
                                <input
                                    type="text"
                                    placeholder="Or paste a Google Sheets URL"
                                    value={sheetUrl}
                                    onChange={(e) => setSheetUrl(e.target.value)}
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '12px', padding: '8px', outline: 'none' }}
                                />
                                <button
                                    onClick={importGoogleSheet}
                                    disabled={!sheetUrl.trim()}
                                    style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '11px', cursor: sheetUrl.trim() ? 'pointer' : 'not-allowed', opacity: sheetUrl.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Link size={12} /> Import
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Client-side Preview before Upload */}
                {selectedFile && !uploading && (
                    <div className="glass-card" style={{ padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {selectedFile.name.endsWith('.csv') ? '📄' : '📊'} {selectedFile.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <div style={{ maxHeight: '100px', overflow: 'auto', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '6px' }}>
                            <table style={{ width: '100%', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                <thead>
                                    <tr>{previewCols.map(c => <th key={c} style={{ textAlign: 'left', padding: '2px 4px', color: 'var(--text-primary)' }}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((r, i) => (
                                        <tr key={i}>{previewCols.map(c => <td key={c} style={{ padding: '2px 4px' }}>{r[c]}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={confirmUpload} style={{ flex: 1, background: 'var(--accent-green)', border: 'none', borderRadius: '8px', padding: '8px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>✅ Upload & Analyze</button>
                            <button onClick={cancelSelection} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>✕ Cancel</button>
                        </div>
                    </div>
                )}

                {/* Uploading State with Progress */}
                {uploading && (
                    <div className="glass-card" style={{ padding: '20px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
                        <div className="drop-zone-icon" style={{ animation: 'spin 2s linear infinite' }}>⚙️</div>
                        <p style={{ fontSize: '13px', marginBottom: '12px' }}>Analyzing {selectedFile?.name}...</p>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-cyan))', transition: 'width 0.3s' }} />
                        </div>
                        <p style={{ fontSize: '10px', marginTop: '8px', color: 'var(--text-muted)' }}>{uploadProgress}%</p>
                    </div>
                )}

                {/* Post-Upload Success State */}
                {uploadResult && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px', borderRadius: '12px', marginBottom: '12px' }}>
                            <p style={{ color: 'var(--accent-green)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {uploadResult.table.startsWith('sheet_') ? '🔗' : (uploadResult.table.endsWith('.xlsx') || uploadResult.table.endsWith('.xls')) ? '📊' : '📄'} ✅ {uploadResult.table} loaded
                            </p>
                            <p style={{ color: 'var(--accent-green)', fontSize: '11px', opacity: 0.8 }}>{uploadResult.rows} rows ready for analysis</p>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Try these AI suggestions:</p>
                            {uploadResult.suggested_questions?.map((q, i) => (
                                <div key={i} className="suggestion-card" style={{ marginBottom: '6px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }} onClick={() => appendToQuery(q)}>
                                    {q}
                                </div>
                            ))}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--accent-cyan)', fontSize: '12px', fontWeight: 600 }}>
                            Ask about this data
                            <ArrowRight size={16} style={{ transform: 'rotate(90deg)', marginTop: '4px', animation: 'bounce 2s infinite' }} />
                        </div>

                        <button onClick={() => { setUploadResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ width: '100%', marginTop: '16px', background: 'transparent', border: '1px dashed var(--glass-border)', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                            + Upload another file
                        </button>
                    </div>
                )}

                {/* Upload Error */}
                {uploadError && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={14} /> {uploadError}
                    </div>
                )}

                {/* Multiple Uploaded Tables List */}
                {tables.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Your Datasets</p>
                        {tables.map(t => (
                            <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '6px' }}>
                                <div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</p>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.row_count} rows</p>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => onTableSwitch?.(t.name)} style={{ background: activeTable === t.name ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Query</button>
                                    <button onClick={() => removeTable(t.name)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Dataset Overview Panel */}
                {activeTable && tables.length > 0 && (
                    <DatasetOverview
                        activeTable={activeTable}
                        allTables={tables}
                        onTableSwitch={onTableSwitch}
                    />
                )}
            </div>
            <style>{`
                @keyframes bounce { 0%, 100% { transform: translateY(0) rotate(90deg); } 50% { transform: translateY(4px) rotate(90deg); } }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </>
    )
}
