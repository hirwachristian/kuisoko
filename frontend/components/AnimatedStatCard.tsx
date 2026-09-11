import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { useCountUp } from '../hooks/useCountUp';

export type StatCardColor = 'emerald' | 'orange' | 'blue' | 'purple' | 'amber';

const COLOR_STYLES: Record<StatCardColor, {
  bg: string; border: string; label: string; value: string; iconBg: string; iconText: string; caption: string; stroke: string; fill: string;
}> = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-100 dark:border-emerald-900',
    label: 'text-emerald-900 dark:text-emerald-200', value: 'text-emerald-950 dark:text-white',
    iconBg: 'bg-white dark:bg-emerald-900', iconText: 'text-emerald-700 dark:text-emerald-300',
    caption: 'text-emerald-600 dark:text-emerald-400', stroke: '#059669', fill: 'rgba(5,150,105,0.16)',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-100 dark:border-orange-900',
    label: 'text-orange-900 dark:text-orange-200', value: 'text-orange-950 dark:text-white',
    iconBg: 'bg-white dark:bg-orange-900', iconText: 'text-orange-700 dark:text-orange-300',
    caption: 'text-orange-600 dark:text-orange-400', stroke: '#ea580c', fill: 'rgba(234,88,12,0.16)',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-100 dark:border-blue-900',
    label: 'text-blue-900 dark:text-blue-200', value: 'text-blue-950 dark:text-white',
    iconBg: 'bg-white dark:bg-blue-900', iconText: 'text-blue-700 dark:text-blue-300',
    caption: 'text-blue-600 dark:text-blue-400', stroke: '#2563eb', fill: 'rgba(37,99,235,0.16)',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-100 dark:border-purple-900',
    label: 'text-purple-900 dark:text-purple-200', value: 'text-purple-950 dark:text-white',
    iconBg: 'bg-white dark:bg-purple-900', iconText: 'text-purple-700 dark:text-purple-300',
    caption: 'text-purple-600 dark:text-purple-400', stroke: '#9333ea', fill: 'rgba(147,51,234,0.16)',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-100 dark:border-amber-900',
    label: 'text-amber-900 dark:text-amber-200', value: 'text-amber-950 dark:text-white',
    iconBg: 'bg-white dark:bg-amber-900', iconText: 'text-amber-700 dark:text-amber-300',
    caption: 'text-amber-600 dark:text-amber-400', stroke: '#d97706', fill: 'rgba(217,119,6,0.16)',
  },
};

interface AnimatedStatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  caption: string;
  color: StatCardColor;
  /** Formats the counted-up integer for display (e.g. currency) - defaults to a plain locale-formatted number. */
  formatValue?: (n: number) => string;
  /** Real daily values, oldest to newest (e.g. last 14 days) - omit to render the card without a sparkline. */
  sparkline?: number[];
  /** Real percent change vs. the prior period, already computed by the caller from actual data - never fabricated here. */
  trendPercent?: number | null;
}

/** A stat card whose number counts up from 0 the first time it scrolls into view, with an optional
 * small sparkline that draws itself in (stroke animated via Motion's pathLength) alongside a real
 * trend percentage - both driven entirely by data the caller computed from actual records, never
 * placeholder or randomized figures. */
const AnimatedStatCard: React.FC<AnimatedStatCardProps> = ({ label, value, icon: Icon, caption, color, formatValue, sparkline, trendPercent }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const displayValue = useCountUp(value, isInView);
  const c = COLOR_STYLES[color];

  let linePoints: string | null = null;
  let areaPoints: string | null = null;
  if (sparkline && sparkline.length > 1) {
    const w = 100;
    const h = 30;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const coords = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return [x, y] as const;
    });
    linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
    areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  }

  return (
    <div ref={ref} className={`flex flex-col gap-2 rounded-2xl p-4 sm:p-6 ${c.bg} border ${c.border} shadow-sm transition-colors duration-300`}>
      <div className="flex justify-between items-start">
        <p className={`${c.label} text-sm font-semibold uppercase tracking-wider`}>{label}</p>
        <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center ${c.iconText} shrink-0`}>
          <Icon size={20} />
        </div>
      </div>
      <p className={`${c.value} tracking-tight text-3xl font-black tabular-nums`}>
        {formatValue ? formatValue(displayValue) : displayValue.toLocaleString()}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs ${c.caption} italic truncate`}>{caption}</p>
        {trendPercent !== undefined && trendPercent !== null && (
          <span className={`text-[11px] font-bold flex items-center gap-0.5 shrink-0 ${trendPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trendPercent >= 0 ? '▲' : '▼'} {Math.abs(trendPercent).toFixed(0)}%
          </span>
        )}
      </div>
      {linePoints && areaPoints && (
        <svg viewBox="0 0 100 30" className="w-full h-8 mt-1 overflow-visible" preserveAspectRatio="none">
          <motion.polygon
            points={areaPoints}
            fill={c.fill}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          />
          <motion.polyline
            points={linePoints}
            fill="none"
            stroke={c.stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={isInView ? { pathLength: 1 } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
      )}
    </div>
  );
};

export default AnimatedStatCard;
