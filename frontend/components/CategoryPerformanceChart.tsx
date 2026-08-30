import React, { useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppContext } from '../context/AppContext';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-emerald-800 font-black">
          {payload[0].value} Products
        </p>
      </div>
    );
  }
  return null;
};

const CategoryPerformanceChart = () => {
  const { products, categories, theme } = useAppContext();
  const [viewMode, setViewMode] = useState<'bar' | 'line' | 'both'>('both');

  const data = useMemo(() => {
    return categories.map(cat => ({
      name: cat,
      count: products.filter(p => p.category === cat).length
    }));
  }, [categories, products]);

  const chartColors = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      mainAccent: isDark ? '#10b981' : '#065f46', // emerald-500 : emerald-800
      secondaryAccent: isDark ? '#fb923c' : '#fb923c', // orange-400
      secondaryAccentArea: isDark ? '#fb923c' : '#fb923c', // orange-400 for gradient
      gridStroke: isDark ? '#334155' : '#f1f5f9', // slate-700 : slate-100
      tickFill: isDark ? '#94a3b8' : '#94a3b8', // slate-400
    };
  }, [theme]);

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900 shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50">Products by Category</h3>
          <p className="text-sm text-slate-400 dark:text-emerald-300 font-medium">Distribution of products per category</p>
        </div>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value as any)}
          className="bg-slate-50 dark:bg-emerald-900 border border-slate-100 dark:border-emerald-800 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none text-emerald-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500"
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.secondaryAccent} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={chartColors.secondaryAccent} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.gridStroke} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: chartColors.tickFill, fontSize: 12, fontWeight: 600}} dy={15} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: chartColors.tickFill, fontSize: 12, fontWeight: 600}} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'transparent' }}
            />
            {(viewMode === 'bar' || viewMode === 'both') && (
                <Bar dataKey="count" name="count" fill={chartColors.mainAccent} radius={[4, 4, 0, 0]} barSize={40} />
            )}
            {(viewMode === 'line' || viewMode === 'both') && (
                <>
                  <Area type="monotone" dataKey="count" name="count" stroke="none" fill="url(#colorCount)" />
                  <Line type="monotone" dataKey="count" name="count" stroke={chartColors.secondaryAccent} strokeWidth={3} dot={{ r: 6, fill: chartColors.secondaryAccent }} />
                </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CategoryPerformanceChart;
