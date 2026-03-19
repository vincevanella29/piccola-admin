/**
 * QrAnalyticsPanel — Recharts-powered analytics for QR scans
 * Google Analytics style: area chart, hourly bars, device breakdown, recent scans
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Smartphone, Monitor, Tablet, Eye, RefreshCw, Loader2,
    TrendingUp, Calendar, Clock as ClockIcon, BarChart3,
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchQrStats } from '../../../../utils/cartaData';

const DEVICE_ICONS = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };
const DEVICE_COLORS_HEX = { mobile: '#3b82f6', desktop: '#8b5cf6', tablet: '#f59e0b' };
const DEVICE_LABELS = { mobile: 'Móvil', desktop: 'Escritorio', tablet: 'Tablet' };
const ACCENT = '#009246';

const StatMini = ({ icon: Icon, value, label, color = 'text-light-accent dark:text-dark-accent' }) => (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/15 dark:border-dark-border/15 min-w-[70px]">
        <Icon className={`w-3.5 h-3.5 ${color} mb-0.5`} />
        <span className="text-base font-bold text-light-text-primary dark:text-dark-text-primary leading-none">{value ?? '—'}</span>
        <span className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{label}</span>
    </div>
);

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="px-2.5 py-1.5 rounded-lg bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold shadow-xl">
            <span className="opacity-60">{label}</span>
            <span className="block text-sm font-bold">{payload[0].value} scans</span>
        </div>
    );
};

const QrAnalyticsPanel = ({ slug, appState }) => {
    const { t } = useTranslation();
    const q = (k) => t(`location.modal.qr.${k}`);

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('30d');

    const fetchStatsData = useCallback(async () => {
        if (!slug) return;
        setLoading(true); setError(null);
        try {
            const data = await fetchQrStats({ token: appState?.token, account: appState?.account, slug });
            setStats(data);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [slug, appState?.token, appState?.account]);

    useEffect(() => { fetchStatsData(); }, [fetchStatsData]);

    const chartData = useMemo(() => {
        if (!stats?.by_day) return [];
        const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
        return stats.by_day.slice(-days).map(d => ({
            ...d, label: d.date.slice(5),
        }));
    }, [stats?.by_day, period]);

    const computed = useMemo(() => {
        if (!chartData.length) return { avg: 0, max: 0, trend: 0 };
        const counts = chartData.map(d => d.count);
        const total = counts.reduce((a, b) => a + b, 0);
        const avg = Math.round(total / counts.length);
        const half = Math.floor(counts.length / 2);
        const first = counts.slice(0, half).reduce((a, b) => a + b, 0) || 1;
        const second = counts.slice(half).reduce((a, b) => a + b, 0);
        const trend = Math.round(((second - first) / first) * 100);
        return { avg, trend };
    }, [chartData]);

    const hourlyData = useMemo(() => {
        if (!stats?.by_hour) return [];
        return Array.from({ length: 24 }, (_, h) => {
            const entry = stats.by_hour.find(e => e.hour === h);
            return { hour: `${h}h`, count: entry?.count || 0 };
        });
    }, [stats?.by_hour]);

    const maxHour = Math.max(1, ...hourlyData.map(h => h.count));

    if (loading && !stats) return (
        <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-light-accent dark:text-dark-accent" />
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Cargando analytics...</span>
        </div>
    );
    if (error) return <div className="px-3 py-2 rounded-lg bg-red-500/8 text-[11px] text-red-500 font-medium">{error}</div>;
    if (!stats) return null;

    const { total = 0, by_device = {}, recent = [] } = stats;
    const lv = stats.live_visitors || 0;
    const deviceEntries = Object.entries(by_device).filter(([_, c]) => c > 0);

    return (
        <div className="space-y-4">
            {/* Stats row */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                        {lv > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${lv > 0 ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{lv}</span>
                    <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60">{q('live')}</span>
                </div>
                <StatMini icon={Eye} value={total.toLocaleString()} label={q('scans')} />
                <StatMini icon={TrendingUp} value={`${computed.avg}/d`} label="Promedio" />
                {computed.trend !== 0 && (
                    <div className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-bold
                        ${computed.trend > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                        <TrendingUp className={`w-3 h-3 ${computed.trend < 0 ? 'rotate-180' : ''}`} />
                        {computed.trend > 0 ? '+' : ''}{computed.trend}%
                    </div>
                )}
                <button type="button" onClick={fetchStatsData} disabled={loading}
                    className="ml-auto p-2 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Area chart */}
            <div className="rounded-2xl bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-light-border/15 dark:border-dark-border/15 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                        <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">Escaneos diarios</span>
                    </div>
                    <div className="flex gap-0.5 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-lg p-0.5">
                        {[{ k: '7d', l: '7D' }, { k: '14d', l: '14D' }, { k: '30d', l: '30D' }].map(p => (
                            <button key={p.k} type="button" onClick={() => setPeriod(p.k)}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all
                                    ${period === p.k ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                {p.l}
                            </button>
                        ))}
                    </div>
                </div>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#999' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#999' }} axisLine={false} tickLine={false} width={25} allowDecimals={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2}
                                fill="url(#scanGrad)" dot={false} activeDot={{ r: 3, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-32 text-light-text-secondary dark:text-dark-text-secondary text-[11px] opacity-40">Sin datos</div>
                )}
            </div>

            {/* Hourly */}
            {hourlyData.some(h => h.count > 0) && (
                <div className="rounded-2xl bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-light-border/15 dark:border-dark-border/15 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                        <ClockIcon className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">{q('hourly')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={hourlyData}>
                            <XAxis dataKey="hour" tick={{ fontSize: 7, fill: '#999' }} axisLine={false} tickLine={false} interval={1} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                                {hourlyData.map((entry, i) => (
                                    <Cell key={i} fill={entry.count > 0 ? `rgba(99,102,241,${0.2 + (entry.count / maxHour) * 0.8})` : 'rgba(128,128,128,0.06)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Devices */}
            {deviceEntries.length > 0 && (
                <div className="rounded-2xl bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-light-border/15 dark:border-dark-border/15 p-4">
                    <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider mb-3 block">Dispositivos</span>
                    <div className="space-y-2">
                        {deviceEntries.sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                            const Icon = DEVICE_ICONS[type] || Monitor;
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const color = DEVICE_COLORS_HEX[type] || '#6b7280';
                            return (
                                <div key={type} className="flex items-center gap-2.5">
                                    <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[10px] font-semibold text-light-text-primary dark:text-dark-text-primary capitalize">{DEVICE_LABELS[type] || type}</span>
                                            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent */}
            {recent.length > 0 && (
                <div className="rounded-2xl bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-light-border/15 dark:border-dark-border/15 overflow-hidden">
                    <div className="px-4 py-2 border-b border-light-border/10 dark:border-dark-border/10">
                        <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">{q('recent')}</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto divide-y divide-light-border/8 dark:divide-dark-border/8">
                        {recent.map((scan, i) => {
                            const DevIcon = DEVICE_ICONS[scan.device_type] || Monitor;
                            const ts = scan.timestamp ? new Date(scan.timestamp) : null;
                            return (
                                <div key={i} className="flex items-center gap-2.5 px-4 py-2 text-[10px] hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition-colors">
                                    <DevIcon className="w-3.5 h-3.5 shrink-0" style={{ color: DEVICE_COLORS_HEX[scan.device_type] || '#6b7280' }} />
                                    <span className="font-medium text-light-text-primary dark:text-dark-text-primary capitalize">{DEVICE_LABELS[scan.device_type] || scan.device_type}</span>
                                    <span className="ml-auto text-light-text-secondary dark:text-dark-text-secondary text-[9px] shrink-0">
                                        {ts ? ts.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {total === 0 && (
                <div className="flex flex-col items-center py-8 gap-2 opacity-25">
                    <BarChart3 className="w-8 h-8" />
                    <p className="text-[11px]">{q('noScans')}</p>
                </div>
            )}
        </div>
    );
};

export default QrAnalyticsPanel;
