import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import NeuralBackground from '../components/NeuralBackground'

export default function RegisterPage() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState({})

    const validate = () => {
        const _errors = {}
        if (!name || name.length < 2) {
            _errors.name = "Full Name must be at least 2 characters"
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            _errors.email = "Valid email is required"
        }
        if (!password || password.length < 6) {
            _errors.password = "Password must be at least 6 characters"
        }
        if (password !== confirmPassword) {
            _errors.confirmPassword = "Passwords do not match"
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
                    name: name.trim(),
                    email: email
                },
                loginTime: new Date().toISOString()
            }
            localStorage.setItem('neuralbi_auth', JSON.stringify(authData))
            navigate('/dashboard')
        }, 1000)
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

                    <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '6px' }}>Create your account</h2>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>Start analyzing your data in seconds</p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: null })) }}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.name ? 'var(--accent-red)' : 'var(--glass-border)'}`,
                                    borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '15px', width: '100%', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                                onBlur={(e) => { e.target.style.borderColor = errors.name ? 'var(--accent-red)' : 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                            />
                            {errors.name && <div style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '4px' }}>{errors.name}</div>}
                        </div>

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

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Confirm Password</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: null })) }}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${errors.confirmPassword ? 'var(--accent-red)' : 'var(--glass-border)'}`,
                                    borderRadius: '12px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '15px', width: '100%', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
                                }}
                                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                                onBlur={(e) => { e.target.style.borderColor = errors.confirmPassword ? 'var(--accent-red)' : 'var(--glass-border)'; e.target.style.boxShadow = 'none' }}
                            />
                            {errors.confirmPassword && <div style={{ color: 'var(--accent-red)', fontSize: '13px', marginTop: '4px' }}>{errors.confirmPassword}</div>}
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
                            {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="spinner-border" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating Account...</span> : "Create Account"}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <a href="/login" style={{ color: 'var(--accent-cyan)', fontSize: '14px', textDecoration: 'none' }}>
                            Already have an account? Sign In →
                        </a>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
