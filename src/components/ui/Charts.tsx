import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react';
import { ScannedItem } from '../../types/inventory';
import { normalizeRound } from '../../utils/storage';
import { EmptyState, Skeleton } from './Controls';
import { EASE_OUT_EXPO } from './MotionPrimitives';

/* ============================================================================
 * 1. BAR CHART — Piezas / Escaneos por Usuario (1 al 14) desglosado por Ronda
 * ==========================================================================*/
export const ScansBarChart: React.FC<{
  scans: ScannedItem[];
  isLoading?: boolean;
}> = ({ scans, isLoading = false }) => {
  const [hoveredUser, setHoveredUser] = useState<number | null>(null);
  const [metric, setMetric] = useState<'scans' | 'pieces'>('scans');

  const data = useMemo(() => {
    const valid = scans.filter((s) => !s.sku?.startsWith('TEST-SKU'));
    return Array.from({ length: 14 }, (_, idx) => {
      const userNum = idx + 1;
      const userScans = valid.filter(
        (s) => s.userNumber === userNum || s.operador === `Usuario ${userNum}`
      );
      const r1 = userScans.filter((s) => normalizeRound(s.conteoRound) === '1ER_CONTEO');
      const r2 = userScans.filter((s) => normalizeRound(s.conteoRound) === '2DO_CONTEO');
      const r3 = userScans.filter((s) => normalizeRound(s.conteoRound) === '3ER_CONTEO');

      const val = (arr: ScannedItem[]) =>
        metric === 'scans'
          ? arr.length
          : arr.reduce((sum, s) => sum + (Number(s.cantidad) || 0), 0);

      const v1 = val(r1);
      const v2 = val(r2);
      const v3 = val(r3);
      return {
        userNum,
        r1: v1,
        r2: v2,
        r3: v3,
        total: v1 + v2 + v3,
      };
    });
  }, [scans, metric]);

  const maxVal = Math.max(1, ...data.map((d) => d.total));
  const activeItem = hoveredUser !== null ? data.find((d) => d.userNum === hoveredUser) : null;

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Productividad por Usuario (1–14)</span>
          </h4>
          <p className="text-[11px] text-slate-400">Comparativa apilada entre 1er, 2do y 3er conteo</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMetric('scans')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              metric === 'scans' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            QR
          </button>
          <button
            type="button"
            onClick={() => setMetric('pieces')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              metric === 'pieces' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Piezas
          </button>
        </div>
      </div>

      {scans.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-5 h-5" />}
          title="Sin actividad registrada"
          description="Las barras de los 14 usuarios aparecerán automáticamente al capturar los primeros QR."
        />
      ) : (
        <>
          <div className="h-44 flex items-end justify-between gap-1.5 pt-4 px-1 border-b border-slate-800/80">
            {data.map((d) => {
              const totalH = (d.total / maxVal) * 100;
              const h1 = d.total > 0 ? (d.r1 / d.total) * totalH : 0;
              const h2 = d.total > 0 ? (d.r2 / d.total) * totalH : 0;
              const h3 = d.total > 0 ? (d.r3 / d.total) * totalH : 0;
              const isHovered = hoveredUser === d.userNum;

              return (
                <button
                  key={d.userNum}
                  type="button"
                  onMouseEnter={() => setHoveredUser(d.userNum)}
                  onMouseLeave={() => setHoveredUser(null)}
                  onClick={() => setHoveredUser(d.userNum)}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`w-full max-w-[26px] flex flex-col-reverse rounded-t-md overflow-hidden transition-all ${
                      isHovered ? 'ring-2 ring-amber-400/80 scale-x-105' : 'opacity-90 group-hover:opacity-100'
                    }`}
                    style={{ height: `${Math.max(d.total > 0 ? 6 : 2, totalH)}%` }}
                  >
                    {d.r1 > 0 && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        style={{ height: `${totalH > 0 ? (h1 / totalH) * 100 : 0}%`, transformOrigin: 'bottom' }}
                        className="w-full bg-emerald-500"
                      />
                    )}
                    {d.r2 > 0 && (
                      <div
                        style={{ height: `${totalH > 0 ? (h2 / totalH) * 100 : 0}%` }}
                        className="w-full bg-blue-500"
                      />
                    )}
                    {d.r3 > 0 && (
                      <div
                        style={{ height: `${totalH > 0 ? (h3 / totalH) * 100 : 0}%` }}
                        className="w-full bg-amber-400"
                      />
                    )}
                    {d.total === 0 && <div className="w-full h-full bg-slate-800/70" />}
                  </div>
                  <span
                    className={`mt-1.5 text-[10px] font-mono tabular-nums ${
                      isHovered ? 'text-amber-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    U{d.userNum}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Legend + Popover Readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 1er
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 2do
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> 3er
              </span>
            </div>
            <div className="font-mono text-slate-300 tabular-nums">
              {activeItem ? (
                <span>
                  <strong className="text-amber-400">Usuario {activeItem.userNum}:</strong>{' '}
                  {activeItem.total.toLocaleString()} {metric === 'scans' ? 'QR' : 'pzs'} (R1: {activeItem.r1}, R2: {activeItem.r2}, R3: {activeItem.r3})
                </span>
              ) : (
                <span className="text-slate-500">Toca o pasa el cursor sobre una barra</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * 2. LINE CHART — Ritmo de Escaneos en Línea de Tiempo (por hora)
 * ==========================================================================*/
export const ScansLineChart: React.FC<{
  scans: ScannedItem[];
  isLoading?: boolean;
}> = ({ scans, isLoading = false }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const buckets = useMemo(() => {
    const valid = scans.filter((s) => !s.sku?.startsWith('TEST-SKU'));
    if (valid.length === 0) return [];
    const grouped = new Map<string, { label: string; count: number; pieces: number; sortKey: number }>();

    for (const s of valid) {
      const d = new Date(s.timestamp);
      if (isNaN(d.getTime())) continue;
      const hourStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
      const key = hourStart.toISOString();
      const label = `${String(hourStart.getHours()).padStart(2, '0')}:00`;
      const prev = grouped.get(key) || { label, count: 0, pieces: 0, sortKey: hourStart.getTime() };
      prev.count += 1;
      prev.pieces += Number(s.cantidad) || 0;
      grouped.set(key, prev);
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-10);
  }, [scans]);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const width = 460;
  const height = 160;
  const padX = 28;
  const padY = 20;
  const maxY = Math.max(1, ...buckets.map((b) => b.count));

  const points = buckets.map((b, i) => {
    const x =
      buckets.length <= 1
        ? width / 2
        : padX + (i / (buckets.length - 1)) * (width - padX * 2);
    const y = height - padY - (b.count / maxY) * (height - padY * 2);
    return { ...b, x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M ${points[0].x},${height - padY} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${
          points[points.length - 1].x
        },${height - padY} Z`
      : '';

  const hovered = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <LineIcon className="w-4 h-4 text-blue-400" />
            <span>Ritmo de Escaneos por Hora</span>
          </h4>
          <p className="text-[11px] text-slate-400">Tendencia operativa del turno</p>
        </div>
        {hovered && (
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono tabular-nums text-blue-300">
            {hovered.label}: <strong>{hovered.count} QR</strong> ({hovered.pieces.toLocaleString()} pzs)
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <EmptyState
          icon={<LineIcon className="w-5 h-5" />}
          title="Sin serie temporal"
          description="La línea de tendencia por hora se construirá automáticamente conforme lleguen escaneos."
        />
      ) : (
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
            <defs>
              <linearGradient id="scanfLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal guides */}
            {[0, 0.5, 1].map((t) => {
              const y = height - padY - t * (height - padY * 2);
              return (
                <line
                  key={t}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.12)"
                  strokeDasharray="4 4"
                />
              );
            })}

            {points.length > 1 && <path d={areaPath} fill="url(#scanfLineGrad)" />}
            {points.length > 1 && (
              <motion.polyline
                initial={{ pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyline}
              />
            )}

            {points.map((p, idx) => {
              const active = hoverIdx === idx || (hoverIdx === null && idx === points.length - 1);
              return (
                <g
                  key={p.label}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onClick={() => setHoverIdx(idx)}
                  className="cursor-pointer"
                >
                  <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? 5.5 : 3.5}
                    fill={active ? '#fbbf24' : '#60a5fa'}
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                  <text
                    x={p.x}
                    y={height - 3}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-mono"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. PIE / DONUT CHART — Distribución por Subinventario / Ronda
 * ==========================================================================*/
const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export const ScansPieChart: React.FC<{
  scans: ScannedItem[];
  isLoading?: boolean;
}> = ({ scans, isLoading = false }) => {
  const [groupBy, setGroupBy] = useState<'subinventario' | 'round'>('round');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const slices = useMemo(() => {
    const valid = scans.filter((s) => !s.sku?.startsWith('TEST-SKU'));
    if (valid.length === 0) return [];
    const counts = new Map<string, number>();

    for (const s of valid) {
      const key =
        groupBy === 'round'
          ? normalizeRound(s.conteoRound) === '1ER_CONTEO'
            ? '1er Conteo'
            : normalizeRound(s.conteoRound) === '2DO_CONTEO'
            ? '2do Conteo'
            : '3er Conteo'
          : (s.subinventario || 'SIN SUBINV').toUpperCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const total = valid.length;
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    let accAngle = 0;
    return sorted.map(([label, value], i) => {
      const pct = value / total;
      const startAngle = accAngle;
      const endAngle = accAngle + pct * 360;
      accAngle = endAngle;
      return {
        label,
        value,
        pct: Math.round(pct * 100),
        color: PIE_COLORS[i % PIE_COLORS.length],
        startAngle,
        endAngle,
      };
    });
  }, [scans, groupBy]);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const focused = activeIdx !== null ? slices[activeIdx] : null;

  const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
    const clampedEnd = endDeg - startDeg >= 359.9 ? startDeg + 359.5 : endDeg;
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startDeg));
    const y1 = cy + r * Math.sin(rad(startDeg));
    const x2 = cx + r * Math.cos(rad(clampedEnd));
    const y2 = cy + r * Math.sin(rad(clampedEnd));
    const large = clampedEnd - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-amber-400" />
            <span>Distribución de Conteo</span>
          </h4>
          <p className="text-[11px] text-slate-400">Proporción por ronda o subinventario</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setGroupBy('round')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              groupBy === 'round' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ronda
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('subinventario')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              groupBy === 'subinventario' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Subinv.
          </button>
        </div>
      </div>

      {slices.length === 0 ? (
        <EmptyState
          icon={<PieIcon className="w-5 h-5" />}
          title="Sin distribución disponible"
          description="El gráfico circular se llenará con tus escaneos activos."
        />
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
          <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(30,41,59,0.7)" strokeWidth="14" />
              {slices.map((sl, i) => (
                <path
                  key={sl.label}
                  d={arcPath(60, 60, 44, sl.startAngle, sl.endAngle)}
                  fill="none"
                  stroke={sl.color}
                  strokeWidth={activeIdx === i ? 17 : 14}
                  strokeLinecap="butt"
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                  onClick={() => setActiveIdx(i === activeIdx ? null : i)}
                  className="cursor-pointer transition-all duration-150"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              <span className="text-lg font-mono font-extrabold text-white tabular-nums leading-none">
                {focused ? `${focused.pct}%` : total}
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[78px] mt-0.5">
                {focused ? focused.label : 'Total QR'}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            {slices.map((sl, i) => (
              <button
                key={sl.label}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => setActiveIdx(i === activeIdx ? null : i)}
                className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                  activeIdx === i ? 'bg-slate-800/80' : 'hover:bg-slate-950/70'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
                  <span className="text-slate-200 font-semibold truncate">{sl.label}</span>
                </span>
                <span className="font-mono text-slate-300 tabular-nums shrink-0">
                  {sl.value} <span className="text-slate-500">({sl.pct}%)</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
