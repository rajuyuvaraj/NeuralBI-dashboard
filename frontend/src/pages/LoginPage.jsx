import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import NeuralBackground from '../components/NeuralBackground'

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState({})

    const validate = () => {
        const _errors = {}
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            _errors.email = "Valid email is required"
        }
        if (!password || password.length < 6) {
            _errors.password = "Password must be at least 6 characters"
        }
        setErrors(_errors)
        return Object.keys(_errors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return

        setLoading(true)
        setTimeout(() => {
            setLoading(false)
            const token = "nb-" + Date.now()
            const authData = {
                token: token,
                user: {
                    name: email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim() || "User",
                    email: email
                },
                loginTime: new Date().toISOString()
            }
            localStorage.setItem('neuralbi_auth', JSON.stringify(authData))
            navigate('/dashboard')
        }, 1000)
    }

    const handleGuestLogin = () => {
        setLoading(true)
        setTimeout(() => {
            const authData = {
                token: "nb-guest-" + Date.now(),
                user: { name: "Guest User", email: "guest@neuralbi.ai" },
                loginTime: new Date().toISOString()
            }
            localStorage.setItem('neuralbi_auth', JSON.stringify(authData))
            navigate('/dashboard')
        }, 800)
    }

    const fillDemoCoords = () => {
        setEmail('demo@neuralbi.ai')
        setPassword('demo123')
    }

    const hasErrors = Object.keys(errors).length > 0;

    return (
        <div style={{ position: 'relative', minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', boxSizing: 'border-box' }} className="auth-layout">
            <NeuralBackground />

            <style>{`
                @media (max-width: 768px) {
                    .auth-layout { grid-template-columns: 1fr !important; }
                    .auth-left { display: none !important; }
                    .auth-right { padding: 20px !important; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .shake-anim { animation: shake 0.4s ease-in-out; }
            `}</style>

            {/* LEFT COLUMN */}
            <div className="auth-left" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10%', zIndex: 10 }}>
                <h1 style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '56px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px'
                }}>
                    NeuralBI
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '20px', marginBottom: '40px' }}>Ask anything. See everything.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                        "🤖 AI-Powered SQL Generation",
                        "📊 Instant Interactive Charts",
                        "💬 Chat With Your Dashboard"
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            className="glass-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.2 }}
                            style={{ padding: '16px 20px', borderRadius: '16px', fontSize: '15px', color: 'var(--text-primary)', display: 'inline-flex', width: 'fit-content' }}
                        >
                            {feature}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="auth-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', zIndex: 10 }}>
                <div className={`glass-card ${hasErrors ? 'shake-anim' : ''}`} style={{ maxWidth: '440px', width: '100%', padding: '40px', borderRadius: '24px', boxSizing: 'border-box' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="14" stroke="url(#gradAuth)" strokeWidth="2" fill="none" />
                            <circle cx="16" cy="10" r="3" fill="#6366f1" />
                            <circle cx="10" cy="20" r="3" fill="#06b6d4" />
                            <circle cx="22" cy="20" r="3" fill="#10b981" />
                            <line x1="16" y1="10" x2="10" y2="20" stroke="#6366f1" strokeWidth="1.5" opacity="0.5" />
                            <line x1="16" y1="10" x2="22" y2="20" stroke="#06b6d4" strokeWidth="1.5" opacity="0.5" />
                            <line x1="10" y1="20" x2="22" y2="20" stroke="#10b981" strokeWidth="1.5" opacity="0.5" />
                            <defs>
                                <linearGradient id="gradAuth" x1="0" y1="0" x2="32" y2="32">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#06b6d4" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '6px' }}>Welcome back</h2>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>Sign in to your dashboard</p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: null })) }}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.email ? 'var(--accent-red)' : 'var(--glass-border)'}`,
                                    borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '15px', width: '100%', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                                onBlur={(e) => { e.target.style.borderColor = errors.email ? 'var(--accent-red)' : 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                            />
                            {errors.email && <div style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '4px' }}>{errors.email}</div>}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: null })) }}
                                    style={{
                                        background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.password ? 'var(--accent-red)' : 'var(--glass-border)'}`,
                                        borderRadius: '12px', padding: '12px 40px 12px 16px', color: 'var(--text-primary)', fontSize: '15px', width: '100%', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                                    onBlur={(e) => { e.target.style.borderColor = errors.password ? 'var(--accent-red)' : 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && <div style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '4px' }}>{errors.password}</div>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                                border: 'none', borderRadius: '12px', color: 'white', fontWeight: 600, fontSize: '15px',
                                width: '100%', height: '48px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.8 : 1
                            }}
                            onMouseOver={(e) => { if (!loading) e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.4)'; e.currentTarget.style.opacity = '0.9' }}
                            onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.opacity = '1' }}
                        >
                            {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="spinner-border" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in...</span> : "Sign In"}
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '12px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or continue with</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                    </div>

                    <button
                        onClick={handleGuestLogin}
                        disabled={loading}
                        style={{
                            border: '1px solid var(--glass-border)', background: 'transparent',
                            borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '14px',
                            width: '100%', height: '48px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onMouseOver={(e) => { if (!loading) e.currentTarget.style.borderColor = 'var(--accent-cyan)' }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)' }}
                    >
                        👤 Continue as Guest
                    </button>

                    <div
                        className="glass-card"
                        onClick={fillDemoCoords}
                        style={{ marginTop: '24px', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                    >
                        Demo: demo@neuralbi.ai / demo123
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <a href="/register" style={{ color: 'var(--accent-cyan)', fontSize: '14px', textDecoration: 'none' }}>
                            Don't have an account? Register →
                        </a>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
