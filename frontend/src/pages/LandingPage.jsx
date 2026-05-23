import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import Lenis from '@studio-freight/lenis'
import './LandingPage.css'

export default function LandingPage() {
    const navigate = useNavigate()
    const isLoggedIn = !!localStorage.getItem('neuralbi_auth') // basic check

    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
        })

        function raf(time) {
            lenis.raf(time)
            requestAnimationFrame(raf)
        }

        requestAnimationFrame(raf)

        const handleScroll = () => {
            const nav = document.querySelector('.landing-nav')
            if (window.scrollY > 50) {
                nav.classList.add('scrolled')
            } else {
                nav.classList.remove('scrolled')
            }
        }
        window.addEventListener('scroll', handleScroll)

        return () => {
            lenis.destroy()
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const scrollTo = (id) => {
        const el = document.getElementById(id)
        if (el) {
            window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' })
        }
    }

    const ScrollReveal = ({ children }) => {
        const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
        return (
            <div ref={ref} className={`fade-up ${inView ? 'visible' : ''}`}>
                {children}
            </div>
        )
    }

    return (
        <div className="landing-page">
            {/* Background elements */}
            <div className="grid-bg"></div>
            <div className="bg-orb bg-orb-1"></div>
            <div className="bg-orb bg-orb-2"></div>
            <div className="bg-orb bg-orb-3"></div>

            {/* SECTION 1 - NAVBAR */}
            <nav className="landing-nav">
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <span className="font-space" style={{ fontSize: '20px', fontWeight: 700 }}>
                        <span className="gradient-text">⬡</span> NeuralBI
                    </span>
                </div>

                <div className="nav-links">
                    <span className="nav-link" onClick={() => scrollTo('features')}>Features</span>
                    <span className="nav-link" onClick={() => scrollTo('how-it-works')}>How it works</span>
                    <span className="nav-link" onClick={() => scrollTo('demo')}>Demo</span>
                    <span className="nav-link" onClick={() => scrollTo('pricing')}>Pricing</span>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    {!isLoggedIn ? (
                        <>
                            <button className="btn-ghost-landing" onClick={() => navigate('/login')}>Sign In</button>
                            <button className="btn-primary-landing" onClick={() => navigate('/login')}>Get Started →</button>
                        </>
                    ) : (
                        <button className="btn-primary-landing" onClick={() => navigate('/dashboard')}>Go to Dashboard →</button>
                    )}
                </div>
            </nav>

            {/* SECTION 2 - HERO */}
            <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', zIndex: 10 }}>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.6, ease: 'easeOut' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '100px', padding: '6px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '28px' }}>
                        <span className="gradient-text" style={{ marginRight: '6px' }}>✦</span> Powered by Llama 3.3 · Built for CXOs
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: 'easeOut' }}>
                    <h1 className="font-space" style={{ fontSize: 'clamp(52px, 8vw, 96px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', margin: 0 }}>
                        Ask Your Data<br />
                        <span className="gradient-text">Anything</span>
                        <span style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}>.</span>
                    </h1>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}>
                    <p style={{ maxWidth: '560px', margin: '20px auto 0', fontSize: '18px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
                        NeuralBI turns your CSV, Excel, and databases into interactive dashboards using plain English. No SQL. No code. Just ask.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6, ease: 'easeOut' }}>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '36px' }}>
                        <button className="btn-hero-primary" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}>
                            {isLoggedIn ? 'Go to Dashboard →' : 'Start Analyzing Free →'}
                        </button>
                        <button className="btn-hero-secondary" onClick={() => scrollTo('demo')}>Watch Demo ▶</button>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}>
                    <div style={{ marginTop: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                        <div style={{ display: 'flex' }}>
                            {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].map((color, i) => (
                                <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}, #050811)`, border: '2px solid #050811', marginLeft: i > 0 ? '-10px' : '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                    {['A', 'B', 'C', 'D', 'E'][i]}
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                            Trusted by <span style={{ color: 'white', fontWeight: 600 }}>2,400+</span> analysts
                            <div style={{ color: '#f59e0b', marginTop: '2px' }}>
                                ★★★★★ <span style={{ color: 'rgba(255,255,255,0.5)' }}>4.9/5 rating</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Hero Mockup */}
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }} style={{ width: '100%' }}>
                    <div className="mockup-container">
                        <div className="mockup-glow"></div>
                        <div className="mockup-card">
                            <div className="mockup-browser-bar">
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }}></span>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }}></span>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }}></span>
                                <div className="mockup-address">app.neuralbi.ai</div>
                            </div>
                            <div className="mockup-content">
                                <div className="mockup-kpi-row">
                                    <div className="mockup-kpi">
                                        <div className="font-space" style={{ fontSize: '24px', fontWeight: 700, color: '#6366f1' }}>$2.34M</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Total Revenue</div>
                                    </div>
                                    <div className="mockup-kpi">
                                        <div className="font-space" style={{ fontSize: '24px', fontWeight: 700, color: '#06b6d4' }}>$847K</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>East Region</div>
                                    </div>
                                    <div className="mockup-kpi">
                                        <div className="font-space" style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>94.2%</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Goal Completion</div>
                                    </div>
                                </div>
                                <div className="mockup-chart-row">
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>Revenue by Region</div>
                                    <div className="mockup-bars">
                                        <div className="mockup-bar" style={{ '--bar-height': '70%', background: 'linear-gradient(to top, rgba(99,102,241,0.2), #6366f1)' }} data-label="East"></div>
                                        <div className="mockup-bar" style={{ '--bar-height': '40%', background: 'linear-gradient(to top, rgba(99,102,241,0.2), #6366f1)' }} data-label="West"></div>
                                        <div className="mockup-bar" style={{ '--bar-height': '90%', background: 'linear-gradient(to top, rgba(99,102,241,0.2), #6366f1)' }} data-label="North"></div>
                                        <div className="mockup-bar" style={{ '--bar-height': '60%', background: 'linear-gradient(to top, rgba(99,102,241,0.2), #6366f1)' }} data-label="South"></div>
                                        <div className="mockup-bar" style={{ '--bar-height': '30%', background: 'linear-gradient(to top, rgba(99,102,241,0.2), #6366f1)' }} data-label="Central"></div>
                                    </div>
                                </div>
                                <div className="mockup-terminal">
                                    <span style={{ fontSize: '16px' }}>💬</span>
                                    <span>Show me top 5 customers by revenue<span className="mockup-cursor"></span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* SECTION 3 - STATS BAR */}
            <section id="stats" style={{ padding: '40px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', position: 'relative', zIndex: 10 }}>
                <ScrollReveal>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                        {[
                            { val: '10x', label: 'Faster than traditional BI' },
                            { val: '< 3s', label: 'Average query response time' },
                            { val: '50+', label: 'Chart types supported' },
                            { val: '100%', label: 'Natural language, no SQL needed' }
                        ].map((stat, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div className="font-space gradient-text" style={{ fontSize: '40px', fontWeight: 700 }}>{stat.val}</div>
                                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </ScrollReveal>
            </section>

            {/* SECTION 4 - FEATURES */}
            <section id="features" style={{ padding: '100px 48px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <ScrollReveal>
                    <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '100px', padding: '6px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                        <span className="gradient-text" style={{ marginRight: '6px' }}>✦</span> Features
                    </div>
                    <h2 className="font-space gradient-text" style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, margin: 0 }}>Everything a CXO needs.</h2>
                    <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', marginTop: '12px', marginBottom: '60px' }}>From raw data to executive insights in seconds.</p>
                </ScrollReveal>

                <div className="features-grid">
                    <ScrollReveal>
                        <div className="feature-card col-span-2">
                            <div className="feature-icon-wrapper">🤖</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>AI Auto-Analysis</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>Open your dashboard and your AI analyst has already prepared 5 key insights — automatically.</p>
                            <div style={{ marginTop: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div><span style={{ color: '#10b981' }}>✓</span> Schema analyzed</div>
                                <div><span style={{ color: '#10b981' }}>✓</span> Questions generated</div>
                                <div><span style={{ color: '#10b981' }}>✓</span> Charts ready</div>
                            </div>
                        </div>
                    </ScrollReveal>
                    <ScrollReveal>
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">💬</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Chat With Your Data</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>Ask in plain English. NeuralBI writes the SQL, runs it, and shows you the chart.</p>
                        </div>
                    </ScrollReveal>
                    <ScrollReveal>
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">📊</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Power BI Dashboards</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>Auto-generated KPI cards, charts, and data tables for any dataset.</p>
                        </div>
                    </ScrollReveal>
                    <ScrollReveal>
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">📤</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Upload Anything</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>CSV, Excel, or paste a Google Sheets URL. Your data is ready to query in seconds.</p>
                        </div>
                    </ScrollReveal>
                    <ScrollReveal>
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">📝</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Executive Reports</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>One click generates a written business narrative — ready to share with your board.</p>
                        </div>
                    </ScrollReveal>
                    <ScrollReveal>
                        <div className="feature-card col-span-2">
                            <div className="feature-icon-wrapper">🔗</div>
                            <h3 className="font-space" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Multi-Dataset JOIN Analysis</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>Select multiple datasets and NeuralBI automatically discovers relationships and joins them for cross-table insights.</p>
                            <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                <span style={{ background: 'rgba(99,102,241,0.2)', padding: '4px 8px', borderRadius: '4px', color: '#818cf8' }}>[Sales]</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>───────</span>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>JOIN</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>───────</span>
                                <span style={{ background: 'rgba(6,182,212,0.2)', padding: '4px 8px', borderRadius: '4px', color: '#2dd4bf' }}>[Customers]</span>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* SECTION 5 - HOW IT WORKS */}
            <section id="how-it-works" style={{ padding: '100px 48px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', position: 'relative', zIndex: 10 }}>
                <ScrollReveal>
                    <h2 className="font-space gradient-text" style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, margin: '0 0 60px 0' }}>How it works.</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', position: 'relative', maxWidth: '1000px', margin: '0 auto' }}>

                        {/* Connecting Line */}
                        <div style={{ position: 'absolute', top: '28px', left: '16.6%', right: '16.6%', borderTop: '1px dashed rgba(255,255,255,0.1)', zIndex: 0 }}></div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'white', margin: '0 auto 20px', fontFamily: '"Space Grotesk", sans-serif' }}>1</div>
                            <h3 className="font-space" style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 12px 0' }}>Upload Your Data</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px 0' }}>Drop a CSV, Excel file, or paste a Google Sheets link. Your data loads instantly.</p>
                            <div style={{ fontSize: '32px' }}>📤</div>
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'white', margin: '0 auto 20px', fontFamily: '"Space Grotesk", sans-serif' }}>2</div>
                            <h3 className="font-space" style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 12px 0' }}>Ask in Plain English</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px 0' }}>Type any business question. Our AI understands context, writes SQL, and fetches the answer.</p>
                            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 16px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>💬 Show me revenue by region</span><span className="mockup-cursor"></span>
                            </div>
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'white', margin: '0 auto 20px', fontFamily: '"Space Grotesk", sans-serif' }}>3</div>
                            <h3 className="font-space" style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 12px 0' }}>Get Instant Insights</h3>
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px 0' }}>Beautiful charts, KPI cards, and written narratives — ready to share with your team.</p>
                            <div style={{ fontSize: '32px' }}>📊</div>
                        </div>

                    </div>
                </ScrollReveal>
            </section>

            {/* SECTION 6 - MARQUEE / DEMO */}
            <section id="demo" style={{ padding: '80px 0', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
                <ScrollReveal>
                    <div style={{ textAlign: 'center', fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '32px' }}>
                        Questions our users ask
                    </div>
                </ScrollReveal>

                <div className="marquee-container" style={{ marginBottom: '16px' }}>
                    <div className="marquee-content scroll-left">
                        {[
                            "Show total revenue by region", "Which product category has highest margin?",
                            "Show monthly sales trend for 2024", "Top 10 customers by lifetime value",
                            "Compare Q3 vs Q4 performance", "Which rep closed most deals?",
                            "Show churn rate by industry", "Revenue breakdown by plan type",
                            // Duplicated for seamless loop
                            "Show total revenue by region", "Which product category has highest margin?",
                            "Show monthly sales trend for 2024", "Top 10 customers by lifetime value"
                        ].map((chip, i) => <div key={i} className="marquee-chip">{chip}</div>)}
                    </div>
                </div>

                <div className="marquee-container">
                    <div className="marquee-content scroll-right">
                        {[
                            "Filter to East Coast only", "Show as pie chart",
                            "What's the average order value?", "Which month had highest sales?",
                            "Show customer segment distribution", "Flag anomalies in revenue data",
                            "Generate executive summary", "Export this as PDF",
                            // Duplicated for seamless loop
                            "Filter to East Coast only", "Show as pie chart",
                            "What's the average order value?", "Which month had highest sales?"
                        ].map((chip, i) => <div key={i} className="marquee-chip">{chip}</div>)}
                    </div>
                </div>
            </section>

            {/* SECTION 7 - CTA BANNER */}
            <section style={{ padding: '100px 48px', textAlign: 'center', position: 'relative', zIndex: 10, overflow: 'hidden' }}>
                <div className="bg-orb-cta"></div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <ScrollReveal>
                        <h2 className="font-space" style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 700, margin: 0, color: 'white' }}>Ready to talk to your data?</h2>
                        <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', marginTop: '16px', maxWidth: '600px', margin: '16px auto 0' }}>Join analysts and executives who get instant insights from their data.</p>
                        <button className="btn-hero-primary" style={{ marginTop: '36px' }} onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}>
                            {isLoggedIn ? 'Go to Dashboard →' : 'Start for Free →'}
                        </button>
                    </ScrollReveal>
                </div>
            </section>

            {/* SECTION 8 - FOOTER */}
            <footer style={{ padding: '48px', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 10 }}>
                <div className="footer-grid">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="font-space" style={{ fontSize: '20px', fontWeight: 700 }}>
                                <span className="gradient-text">⬡</span> NeuralBI
                            </span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Ask anything. See everything.</p>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', fontWeight: 600 }}>Product</div>
                        <a href="#features" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('features') }}>Features</a>
                        <a href="#how-it-works" className="footer-link" onClick={e => { e.preventDefault(); scrollTo('how-it-works') }}>How it works</a>
                        <a href="#" className="footer-link">Dashboard</a>
                        <a href="#" className="footer-link">Pricing</a>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', fontWeight: 600 }}>Developers</div>
                        <a href="#" className="footer-link">API Docs</a>
                        <a href="#" className="footer-link">GitHub</a>
                        <a href="#" className="footer-link">Changelog</a>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', fontWeight: 600 }}>Company</div>
                        <a href="#" className="footer-link">About</a>
                        <a href="#" className="footer-link">Blog</a>
                        <a href="#" className="footer-link">Contact</a>
                    </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '40px', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© 2026 NeuralBI. All rights reserved.</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Made with ❤️ for data-driven decisions</div>
                </div>
            </footer>
        </div>
    )
}
