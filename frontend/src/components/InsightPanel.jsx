import { motion } from 'framer-motion'

export default function InsightPanel({ insights }) {
    if (!insights || insights.length === 0) return null

    return (
        <div className="insight-panel">
            <div className="insight-title">🧠 AI Insights</div>
            {insights.map((insight, i) => (
                <motion.div
                    key={i}
                    className={`insight-item insight-border-${i % 3}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2, duration: 0.4 }}
                >
                    {insight}
                </motion.div>
            ))}
        </div>
    )
}
