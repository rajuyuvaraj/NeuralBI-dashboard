import { useRef, useEffect } from 'react'

export default function NeuralBackground({ isQuerying }) {
    const canvasRef = useRef(null)
    const particlesRef = useRef([])
    const mouseRef = useRef({ x: -1000, y: -1000 })
    const queryPulseRef = useRef(false)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationId

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        resize()
        window.addEventListener('resize', resize)

        // Init particles
        const PARTICLE_COUNT = 80
        if (particlesRef.current.length === 0) {
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particlesRef.current.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.6,
                    vy: (Math.random() - 0.5) * 0.6,
                    radius: 2 + Math.random() * 2,
                    baseRadius: 2 + Math.random() * 2,
                    color: Math.random() > 0.5 ? '#6366f1' : '#06b6d4',
                })
            }
        }

        const handleMouse = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener('mousemove', handleMouse)

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const particles = particlesRef.current

            particles.forEach((p) => {
                // Move
                p.x += p.vx
                p.y += p.vy

                // Bounce
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1

                // Cursor repulsion
                const dx = p.x - mouseRef.current.x
                const dy = p.y - mouseRef.current.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < 100 && dist > 0) {
                    const force = (100 - dist) / 100
                    p.x += (dx / dist) * force * 1.5
                    p.y += (dy / dist) * force * 1.5
                }

                // Query pulse effect
                if (queryPulseRef.current) {
                    p.radius = p.baseRadius * 2
                } else {
                    p.radius += (p.baseRadius - p.radius) * 0.05
                }

                // Draw particle
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
                ctx.fillStyle = p.color
                ctx.globalAlpha = 0.6
                ctx.fill()
            })

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x
                    const dy = particles[i].y - particles[j].y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < 150) {
                        ctx.beginPath()
                        ctx.moveTo(particles[i].x, particles[i].y)
                        ctx.lineTo(particles[j].x, particles[j].y)
                        ctx.strokeStyle = particles[i].color
                        ctx.globalAlpha = (1 - dist / 150) * 0.15
                        ctx.lineWidth = 1
                        ctx.stroke()
                    }
                }
            }

            ctx.globalAlpha = 1
            animationId = requestAnimationFrame(animate)
        }

        animate()

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', resize)
            window.removeEventListener('mousemove', handleMouse)
        }
    }, [])

    // Handle query pulse
    useEffect(() => {
        if (isQuerying) {
            queryPulseRef.current = true
            const timer = setTimeout(() => {
                queryPulseRef.current = false
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [isQuerying])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
            }}
        />
    )
}
