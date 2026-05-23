import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie,
    AreaChart, Area,
    ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
    Sector
} from 'recharts'
import { useMemo, useState } from 'react'

const COLORS = [
    '#6366f1', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
]

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(10, 22, 40, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 1000
            }}>
                <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', margin: 0 }}>
                    {label}
                </p>
                {payload.map((entry, i) => (
                    <p key={i} style={{ color: entry.color, fontSize: '14px', fontWeight: '600', margin: '4px 0 0 0' }}>
                        {entry.name}: {
                            typeof entry.value === 'number'
                                ? entry.value.toLocaleString('en-US', {
                                    style: entry.name.toLowerCase().includes('revenue') ? 'currency' : 'decimal',
                                    currency: 'USD',
                                    maximumFractionDigits: 0
                                })
                                : entry.value
                        }
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 15}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
        </g>
    );
};

export default function ChartRenderer({ data, config }) {
    const [hiddenSeries, setHiddenSeries] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);

    if (!data || data.length === 0 || !config) return null;

    // Safety override: never render pie with > 8 slices
    let safeConfig = { ...config }
    if (safeConfig.chart_type === 'pie' && data.length > 8) {
        safeConfig = {
            ...safeConfig,
            chart_type: 'bar'
        }
    }

    const { chart_type, x_axis, y_axis, color_field } = safeConfig;

    const toggleSeries = (dataKey) => {
        if (hiddenSeries.includes(dataKey)) {
            setHiddenSeries(hiddenSeries.filter(s => s !== dataKey));
        } else {
            setHiddenSeries([...hiddenSeries, dataKey]);
        }
    };

    const handleLegendClick = (e) => {
        if (e && e.dataKey) toggleSeries(e.dataKey);
    };

    const total = useMemo(() => {
        return data.reduce((sum, d) => sum + (Number(d[y_axis]) || 0), 0)
    }, [data, y_axis]);

    const groups = useMemo(() => {
        if (chart_type !== 'grouped_bar' || !color_field) return []
        return [...new Set(data.map((d) => d[color_field]))]
    }, [data, chart_type, color_field]);

    const groupedData = useMemo(() => {
        if (chart_type !== 'grouped_bar' || !color_field) return data
        const pivoted = {}
        data.forEach((d) => {
            const key = d[x_axis]
            if (!pivoted[key]) pivoted[key] = { [x_axis]: key }
            pivoted[key][d[color_field]] = Number(d[y_axis]) || 0
        })
        return Object.values(pivoted)
    }, [data, chart_type, x_axis, y_axis, color_field]);

    const gridProps = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.06)' };
    const axisProps = { tick: { fill: '#94a3b8', fontSize: 12 }, axisLine: { stroke: 'rgba(255,255,255,0.08)' }, tickLine: false };
    const animProps = { isAnimationActive: true, animationDuration: 800, animationEasing: 'ease-out' };

    switch (chart_type) {
        case 'line':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={data}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey={x_axis} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey={y_axis}
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ r: 4, strokeWidth: 2, fill: '#6366f1' }}
                            activeDot={{ r: 7, strokeWidth: 0, fill: '#6366f1' }}
                            {...animProps}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )

        case 'bar':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey={x_axis} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar
                            dataKey={y_axis}
                            radius={[6, 6, 0, 0]}
                            {...animProps}
                        >
                            {data.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )

        case 'pie':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie
                            data={data}
                            dataKey={y_axis}
                            nameKey={x_axis}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={100}
                            activeIndex={activeIndex}
                            activeShape={renderActiveShape}
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(-1)}
                            {...animProps}
                            label={(entry) => `${entry[x_axis]}: ${((entry[y_axis] / total) * 100).toFixed(1)}%`}
                            labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                        >
                            {data.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            )

        case 'area':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey={x_axis} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey={y_axis}
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#areaGrad)"
                            {...animProps}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )

        case 'scatter':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart>
                        <CartesianGrid {...gridProps} />
                        <XAxis type="number" dataKey={x_axis} name={x_axis} {...axisProps} />
                        <YAxis type="number" dataKey={y_axis} name={y_axis} {...axisProps} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter
                            data={data}
                            fill="#6366f1"
                            {...animProps}
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            )

        case 'grouped_bar':
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={groupedData}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey={x_axis} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Legend
                            wrapperStyle={{ color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
                            onClick={handleLegendClick}
                        />
                        {groups.map((group, i) => (
                            <Bar
                                key={group}
                                dataKey={group}
                                fill={COLORS[i % COLORS.length]}
                                radius={[6, 6, 0, 0]}
                                hide={hiddenSeries.includes(group)}
                                {...animProps}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )

        default:
            return (
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey={x_axis} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey={y_axis} radius={[6, 6, 0, 0]} fill="#6366f1" />
                    </BarChart>
                </ResponsiveContainer>
            )
    }
}
