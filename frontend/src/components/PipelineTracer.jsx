import { Brain, Code2, Database, BarChart3, CheckCircle2 } from 'lucide-react'

const STAGES = [
    { label: 'Intent', icon: Brain },
    { label: 'SQL', icon: Code2 },
    { label: 'Database', icon: Database },
    { label: 'Chart', icon: BarChart3 },
    { label: 'Done', icon: CheckCircle2 },
]

export default function PipelineTracer({ stage, visible }) {
    if (!visible) return null

    return (
        <div className="pipeline-tracer" style={{
            animation: stage >= 5 ? 'none' : undefined,
            opacity: stage >= 5 ? 0 : 1,
            transition: 'opacity 0.5s ease',
        }}>
            {STAGES.map((s, i) => {
                const Icon = s.icon
                let status = 'pending'
                if (i < stage) status = 'done'
                else if (i === stage) status = 'active'

                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={`pipeline-node ${status}`}>
                            <Icon size={14} />
                            <span>{s.label}</span>
                        </div>
                        {i < STAGES.length - 1 && (
                            <div className={`pipeline-line ${i < stage ? 'done' : i === stage ? 'active' : ''}`} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
