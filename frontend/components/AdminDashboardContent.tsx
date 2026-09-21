
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import {
  LayoutDashboard, Users, Receipt, Calendar, Plus, ArrowUpRight, Zap,
  Box, Folder, ClipboardList, Package, Printer, Wallet, RefreshCw, FileText
} from 'lucide-react';
import { ORDER_STATUS_COLORS } from '../constants';
import { useAppContext } from '../context/AppContext';
import { apiFetch } from '../api';
import { getStockLevel } from '../utils';
import CategoryPerformanceChart from './CategoryPerformanceChart';
import KuISOKOLogoSVG from './KuISOKOLogoSVG';
import AnimatedStatCard from './AnimatedStatCard';
import AdminPagination from './AdminPagination';

const SPARKLINE_DAYS = 14;

/** Buckets dated records into a fixed-length array of daily totals, oldest to newest, ending
 * today - used to build each stat card's real sparkline from actual timestamps rather than
 * fabricated data. `value` defaults to 1 per record (a count); pass it for a sum (e.g. revenue). */
function buildDailySeries(records: { date: string; value?: number }[], days = SPARKLINE_DAYS): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = new Array(days).fill(0);
  for (const r of records) {
    const d = new Date(r.date);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) series[idx] += r.value ?? 1;
  }
  return series;
}

/** Percent change between the second half and first half of a daily series - a simple, honest
 * "this period vs. the one before it" comparison. Returns null when there's no earlier-half
 * baseline to compare against, rather than showing a misleading/infinite percentage. */
function computeTrendPercent(series: number[]): number | null {
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((a, b) => a + b, 0);
  const prior = series.slice(0, half).reduce((a, b) => a + b, 0);
  if (prior === 0) return null;
  return ((recent - prior) / prior) * 100;
}

// Custom Legend component for the Pie Chart
// It now directly accepts chartData, totalPieValue, and getFormattedPrice
const CustomPieLegend = (props: { chartData: any[], totalPieValue: number, getFormattedPrice: (price: number) => string }) => {
  const { chartData, totalPieValue, getFormattedPrice } = props;
  return (
    <ul className="space-y-3 pl-4">
      {chartData.map((entry: any, index: number) => {
        const percent = ((entry.value / totalPieValue) * 100).toFixed(1);
        return (
          <li key={`item-${index}`} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="text-sm font-semibold text-slate-700">{entry.name}</span>
            <span className="text-xs text-slate-500">{entry.valueFormatted} ({percent}%)</span>
          </li>
        );
      })}
    </ul>
  );
};

// Wraps a product name onto up to 2 lines at word boundaries (same idea as the line-clamp-2 used
// for product names on ProductCard) - short names stay on one line, longer ones wrap instead of
// getting cut off mid-word, with a trailing "…" only if a 3rd line's worth of text remains.
const wrapProductName = (name: string, maxLineLength = 15): string[] => {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLineLength) {
      current = candidate;
    } else {
      lines.push(current || word.slice(0, maxLineLength));
      current = current ? word : '';
    }
  }
  if (current) lines.push(current);

  if (lines.length <= 2) return lines;
  const shown = lines.slice(0, 2);
  const maxLast = maxLineLength - 1; // leave room for the ellipsis character
  shown[1] = (shown[1].length > maxLast ? shown[1].slice(0, maxLast) : shown[1]) + '…';
  return shown;
};

// Performance color scale for the Top-Selling Products chart: each bar's color is interpolated
// along red -> amber -> green by its revenue relative to the #1 seller, so the color itself
// communicates how strongly a product is performing against the best one, not just its rank.
const PERFORMANCE_COLOR_STOPS: [number, string][] = [
  [0, '#ef4444'],   // red-500 - weak relative to the top seller
  [0.5, '#f59e0b'], // amber-500 - moderate
  [1, '#059669'],   // emerald-600 - matching (or near) the top seller
];

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const getPerformanceColor = (ratio: number): string => {
  const clamped = Math.max(0, Math.min(1, ratio));
  let [lowT, lowColor] = PERFORMANCE_COLOR_STOPS[0];
  let [highT, highColor] = PERFORMANCE_COLOR_STOPS[PERFORMANCE_COLOR_STOPS.length - 1];
  for (let i = 0; i < PERFORMANCE_COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = PERFORMANCE_COLOR_STOPS[i];
    const [t1, c1] = PERFORMANCE_COLOR_STOPS[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      [lowT, lowColor, highT, highColor] = [t0, c0, t1, c1];
      break;
    }
  }
  const localRatio = highT === lowT ? 0 : (clamped - lowT) / (highT - lowT);
  const rgb0 = hexToRgb(lowColor);
  const rgb1 = hexToRgb(highColor);
  const mixed = rgb0.map((c, i) => Math.round(c + (rgb1[i] - c) * localRatio));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
};

// Custom YAxis tick for the Top-Selling Products bar chart - renders the (possibly 2-line)
// wrapped product name as SVG <tspan>s, since CSS truncate/line-clamp doesn't apply inside SVG.
// Colored to match its bar (via the tick's index into the same performance-color array).
const ProductNameTick = (props: any) => {
  const { x, y, payload, index, colors, maxLineLength } = props;
  const lines = wrapProductName(payload.value, maxLineLength ?? 15);
  const color = colors?.[index] ?? '#1e293b';
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={lines.length === 1 ? 4 : i === 0 ? -2 : 11}
          textAnchor="end"
          fill={color}
          fontSize={12}
          fontWeight={700}
        >
          {line}
        </text>
      ))}
    </g>
  );
};

// Fix: Changed from default export to named export
export const AdminDashboardContent: React.FC = () => {
  const { user, token, logout, categories, products, orders, getFormattedPrice, categoryHierarchy } = useAppContext();
  // Full records (not just a count) so the Total Users card can draw a real signups-over-time
  // sparkline from `registrationDate`, the same way the Orders/Revenue cards do from `orders`.
  const [userRecords, setUserRecords] = useState<{ registrationDate?: string }[] | null>(null);
  const totalUsers = userRecords?.length ?? null;
  // Inventory Overview - stock-level filter (out/low/in, mirroring getStockLevel's 4 tiers with
  // medium+high collapsed into "In Stock" for a simpler restock-focused view), an optional
  // category filter, and its own pagination page.
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'out' | 'low' | 'in'>('all');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('all');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [timeRange, setTimeRange] = useState<'all' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [activeCategorySlice, setActiveCategorySlice] = useState<number | null>(null);
  const location = useLocation();

  // Recharts props like Pie's radii or the Legend's pixel width aren't CSS - ResponsiveContainer
  // only scales the SVG viewport, it can't shrink a hardcoded `outerRadius={155}` on a narrow phone.
  // Tracking the viewport ourselves lets the donut (and its legend layout) actually adapt below `sm`.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  React.useEffect(() => {
    if (timeRange === 'custom' && startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        setDateError('Start Date cannot be after End Date.');
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }
  }, [timeRange, startDate, endDate]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { users } = await apiFetch<{ users: { registrationDate?: string }[] }>('/users', {}, token);
        if (!cancelled) setUserRecords(users);
      } catch (e) {
        console.error('Error fetching user count:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const isWithinThisMonth = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const isWithinRange = (dateString: string) => {
    const date = new Date(dateString);
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    date.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  // Renders the hidden #website-report-content-for-pdf node (see JSX below) to a PDF and saves it -
  // same html2pdf.js pattern already used for order invoices in AdminManageOrders.tsx.
  const handleGenerateReport = () => {
    const element = document.getElementById('website-report-content-for-pdf');
    if (!element) return;
    import('html2pdf.js').then((html2pdf) => {
      const opt = {
        margin: 0.5,
        filename: `KuISOKO-Store-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
      };
      html2pdf.default().set(opt).from(element as HTMLElement).save();
    });
  };

  // Collapses getStockLevel's 4 tiers (out/low/medium/high) into the 3 an admin actually restocks
  // against - "medium" and "high" both just mean "don't worry about this one yet".
  const inventoryStockTier = (stock: number): 'out' | 'low' | 'in' => {
    const level = getStockLevel(stock);
    return level === 'out' ? 'out' : level === 'low' ? 'low' : 'in';
  };

  const INVENTORY_PER_PAGE = 8;
  const filteredInventory = useMemo(() => {
    return products.filter((p) => {
      if (inventoryStockFilter !== 'all' && inventoryStockTier(p.stock) !== inventoryStockFilter) return false;
      if (inventoryCategoryFilter !== 'all' && p.category !== inventoryCategoryFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, inventoryStockFilter, inventoryCategoryFilter]);
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventory.length / INVENTORY_PER_PAGE));
  const paginatedInventory = filteredInventory.slice((inventoryPage - 1) * INVENTORY_PER_PAGE, inventoryPage * INVENTORY_PER_PAGE);
  // A changed filter starts a fresh browse rather than landing on whatever page happened to be
  // selected under the previous filter (which could now be empty or mid-list).
  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryStockFilter, inventoryCategoryFilter]);

  const chartColors = useMemo(() => {
    // Hardcoding light mode colors
    return {
      mainAccent: '#065f46', // emerald-900
      secondaryAccent: '#fb923c', // orange-500
      gridStroke: '#f1f5f9', // slate-100
      tickFill: '#94a3b8', // slate-400
      tooltipBg: '#ffffff', // white
      tooltipBorder: 'none',
      categoryColors: [
        { name: 'Electronics', color: '#065f46' }, // emerald-900
        { name: 'Fashion', color: '#fb923c' },    // orange-500
        { name: 'Home & Living', color: '#10b981' }, // emerald-500
        { name: 'Beauty', color: '#f59e0b' },   // amber-500
        { name: 'Sports', color: '#a3e635' },    // lime-500
      ],
      orderStatusColorsChart: { // For Donut Chart
        'Pending': '#fbbf24', // amber-400
        'Processing': '#10b981', // emerald-500
        'Shipped': '#6366f1', // indigo-500
        'Delivered': '#10b981', // emerald-500
        'Cancelled': '#ef4444', // red-500
      },
      pieLabelFill: '#1e293b', // slate-900
    };
  }, []);

  const productsAnalytics = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    return { totalProducts, totalStock };
  }, [products]);

  const categoriesAnalytics = useMemo(() => {
    const totalCategories = categories.length;
    let totalSubSections = 0;
    const productsPerCategory = categories.map(cat => {
      const count = products.filter(p => p.category === cat).length;
      totalSubSections += (categoryHierarchy[cat]?.length || 0); // Sum up sub-sections
      return { name: cat, products: count };
    }).sort((a,b) => b.products - a.products).slice(0,5); // Top 5 categories by product count for chart

    return { totalCategories, totalSubSections, productsPerCategory };
  }, [categories, products, categoryHierarchy]);

  // Only counts orders with confirmed payment (MTN MoMo auto-confirms; manual payment methods are
  // confirmed by the admin via "Confirm Payment" after verifying the sent/downloaded invoice) - so
  // this reflects money actually received, not just orders placed. Recomputes automatically the
  // moment `orders` changes, e.g. right after confirming a payment or on the next admin poll tick.
  const totalRevenue = useMemo(
    () => orders.filter(order => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0),
    [orders]
  );

  // Real day-by-day series for the overview cards' sparklines/trend pills - built from actual
  // registration/order dates, never fabricated. Products/Categories have no per-day creation data
  // on the frontend, so those two cards intentionally get the count-up animation only, no sparkline.
  const usersDailySeries = useMemo(
    () => buildDailySeries((userRecords ?? []).filter(u => u.registrationDate).map(u => ({ date: u.registrationDate! }))),
    [userRecords]
  );
  const usersTrendPercent = useMemo(() => computeTrendPercent(usersDailySeries), [usersDailySeries]);

  const ordersDailySeries = useMemo(() => buildDailySeries(orders.map(o => ({ date: o.date }))), [orders]);
  const ordersTrendPercent = useMemo(() => computeTrendPercent(ordersDailySeries), [ordersDailySeries]);

  const revenueDailySeries = useMemo(
    () => buildDailySeries(orders.filter(o => o.paymentStatus === 'paid').map(o => ({ date: o.date, value: o.total }))),
    [orders]
  );
  const revenueTrendPercent = useMemo(() => computeTrendPercent(revenueDailySeries), [revenueDailySeries]);

  // All-time order counts by status, for the website summary report - unlike ordersAnalytics
  // below, this is never time-range filtered, since the report is meant to be a full snapshot.
  const allTimeOrderStatusCounts = useMemo(
    () => Object.keys(ORDER_STATUS_COLORS).map(status => ({
      status,
      count: orders.filter(o => o.status === status).length,
    })),
    [orders]
  );

  const ordersAnalytics = useMemo(() => {
    const filteredOrders = timeRange === 'all' 
      ? orders 
      : timeRange === 'thisMonth'
      ? orders.filter(order => isWithinThisMonth(order.date))
      : (dateError ? [] : orders.filter(order => isWithinRange(order.date)));

    const totalOrders = filteredOrders.length;
    const deliveredOrdersRevenue = filteredOrders
      .filter(order => order.status === 'Delivered')
      .reduce((sum, order) => sum + order.total, 0);

    // Order status distribution for the donut chart
    const orderStatusDistribution = Object.keys(ORDER_STATUS_COLORS).map(status => {
      const count = filteredOrders.filter(order => order.status === status).length;
      return {
        name: status.charAt(0).toUpperCase() + status.slice(1) + ' Orders',
        value: count,
        color: chartColors.orderStatusColorsChart[status as keyof typeof chartColors.orderStatusColorsChart]
      };
    }).filter(s => s.value > 0); // Only show statuses with orders

    return { totalOrders, deliveredOrdersRevenue, orderStatusDistribution };
  }, [orders, timeRange, startDate, endDate, dateError, chartColors.orderStatusColorsChart, isWithinThisMonth, isWithinRange]);


  // Real revenue per category, derived from actual orders + products (not mock data)
  const revenueByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const productId = (item as any).productId ?? item.id;
        const product = products.find(p => p.id === productId);
        const categoryName = product?.category ?? 'Other';
        totals.set(categoryName, (totals.get(categoryName) ?? 0) + item.price * item.quantity);
      }
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [orders, products]);

  const dynamicCategoryPieData = useMemo(() => revenueByCategory.map((item, index) => ({
    ...item,
    color: chartColors.categoryColors[index % chartColors.categoryColors.length].color,
    valueFormatted: getFormattedPrice(item.value),
  })), [revenueByCategory, chartColors, getFormattedPrice]);

  const totalPieValue = dynamicCategoryPieData.reduce((sum, entry) => sum + entry.value, 0);

  // Top 5 products by revenue, derived from actual orders (same source/shape as revenueByCategory
  // above, just grouped by product instead of category - not time-range filtered, to stay
  // consistent with the Category Split pie chart it sits next to).
  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; revenue: number; unitsSold: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const productId = (item as any).productId ?? item.id;
        const key = productId ?? item.name;
        const existing = totals.get(key) ?? { name: item.name, revenue: 0, unitsSold: 0 };
        existing.revenue += item.price * item.quantity;
        existing.unitsSold += item.quantity;
        totals.set(key, existing);
      }
    }
    return Array.from(totals.values())
      .filter(p => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  // Each product's color, scaled by its revenue relative to the #1 seller (index 0).
  const topProductColors = useMemo(() => {
    const topRevenue = topProducts[0]?.revenue || 0;
    return topProducts.map(p => getPerformanceColor(topRevenue > 0 ? p.revenue / topRevenue : 0));
  }, [topProducts]);

  // The hovered slice pops outward with a second thin outline ring, and its name/value/percent
  // replace the chart's default center label while active - the classic recharts "active shape"
  // donut interaction, used here to make the Category Split chart feel a lot more alive.
  const renderActiveCategorySlice = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" fill={chartColors.pieLabelFill} fontSize={15} fontWeight={800}>
          {payload.name}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={fill} fontSize={13} fontWeight={700}>
          {`${getFormattedPrice(value)} (${(percent * 100).toFixed(1)}%)`}
        </text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 12} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        <Sector cx={cx} cy={cy} innerRadius={outerRadius + 16} outerRadius={outerRadius + 20} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      </g>
    );
  };

  return (
    <>
      {/* Hidden website summary report, rendered to PDF by handleGenerateReport via html2pdf.js -
          same off-screen technique used for order invoices, kept out of the visible layout. */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', opacity: 0, pointerEvents: 'none' }}>
        <div id="website-report-content-for-pdf" style={{ width: '100%', boxSizing: 'border-box', padding: '32px', color: '#1a1a1a', background: '#ffffff', fontFamily: 'sans-serif' }}>
          <div style={{ marginBottom: '36px' }}>
            <KuISOKOLogoSVG className="h-10 w-auto block" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 6px' }}>Store Summary Report</h1>
          <p style={{ fontSize: '14px', color: '#666', margin: '0 0 32px' }}>Generated {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>

          {/* breakInside: 'avoid' on each section (and each row) tells html2pdf.js's CSS pagebreak
              mode to push the whole block onto the next page instead of slicing it mid-heading or
              mid-row when it would otherwise straddle a page boundary. */}
          <div style={{ breakInside: 'avoid', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>Overview</h2>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Total Users', String(totalUsers ?? '—')],
                  ['Total Products', String(productsAnalytics.totalProducts)],
                  ['Total Stock Across All Products', String(productsAnalytics.totalStock)],
                  ['Total Categories', String(categoriesAnalytics.totalCategories)],
                  ['Total Sub-Sections', String(categoriesAnalytics.totalSubSections)],
                  ['Total Orders', String(orders.length)],
                  ['Total Revenue (confirmed payments)', getFormattedPrice(totalRevenue)],
                ].map(([label, value]) => (
                  <tr key={label} style={{ breakInside: 'avoid' }}>
                    <td style={{ width: '65%', padding: '8px 4px 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', color: '#555', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{label}</td>
                    <td style={{ width: '35%', padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ breakInside: 'avoid', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>Revenue by Category</h2>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '50%', textAlign: 'left', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Category</th>
                  <th style={{ width: '25%', textAlign: 'right', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Revenue</th>
                  <th style={{ width: '25%', textAlign: 'right', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {revenueByCategory.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '10px 0', fontSize: '14px', color: '#888' }}>No revenue recorded yet.</td></tr>
                ) : revenueByCategory.map((c) => (
                  <tr key={c.name} style={{ breakInside: 'avoid' }}>
                    <td style={{ padding: '8px 4px 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{c.name}</td>
                    <td style={{ padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right', wordBreak: 'break-word' }}>{getFormattedPrice(c.value)}</td>
                    <td style={{ padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{totalPieValue > 0 ? `${((c.value / totalPieValue) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ breakInside: 'avoid', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>Top-Selling Products</h2>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '55%', textAlign: 'left', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Product</th>
                  <th style={{ width: '20%', textAlign: 'right', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Units Sold</th>
                  <th style={{ width: '25%', textAlign: 'right', paddingBottom: '8px', fontSize: '13px', borderBottom: '1px solid #ccc' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '10px 0', fontSize: '14px', color: '#888' }}>No sales yet.</td></tr>
                ) : topProducts.map((p) => (
                  <tr key={p.name} style={{ breakInside: 'avoid' }}>
                    <td style={{ padding: '8px 4px 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{p.name}</td>
                    <td style={{ padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{p.unitsSold}</td>
                    <td style={{ padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right', wordBreak: 'break-word' }}>{getFormattedPrice(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ breakInside: 'avoid', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, borderBottom: '2px solid #1a1a1a', paddingBottom: '10px', marginBottom: '16px' }}>Orders by Status</h2>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <tbody>
                {allTimeOrderStatusCounts.map(({ status, count }) => (
                  <tr key={status} style={{ breakInside: 'avoid' }}>
                    <td style={{ width: '65%', padding: '8px 4px 8px 0', fontSize: '14px', borderBottom: '1px solid #eee', color: '#555', wordBreak: 'break-word' }}>{status}</td>
                    <td style={{ width: '35%', padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ breakInside: 'avoid' }}>
            {/* Company stamp sits beside the "Issued by" block in a flex row, not on top of it,
                so it can never end up overlapping (and obscuring) that text - kept in this same
                breakInside:'avoid' block, not positioned against the whole possibly-multi-page
                report, so it reliably lands next to the signature wherever that ends up. */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' }}>
              <div style={{ fontSize: '13px', color: '#666' }}>
                <p><strong>Issued by:</strong> {user?.name || 'Admin'}</p>
                <p><strong>Email:</strong> {user?.email || 'admin@example.com'}</p>
              </div>
              <img
                src="/branding/stamp.png"
                alt=""
                style={{
                  width: '110px',
                  height: 'auto',
                  opacity: 0.9,
                  transform: 'rotate(-14deg)',
                  flexShrink: 0,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: '2px solid #0B5D3B', textAlign: 'center' }}>
              <p style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px', color: '#0B5D3B' }}>KuISOKO</p>
              <p style={{ fontSize: '13px', margin: 0, color: '#888' }}>Generated by the KuISOKO Admin Dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-wrap justify-between items-end gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-slate-900 dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">Dashboard Overview</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">Welcome, Admin! Here is your dashboard overview.</p>
            </div>
            {/* Button row stays a single fixed layout regardless of the time-range selection - the
                custom date-range picker (below) is a separate row, not squeezed in here, so nothing
                about this row (including the notification bell) ever shifts when "Custom" is picked. */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                aria-label="Refresh dashboard"
                title="Refresh dashboard"
              >
                <RefreshCw size={18} />
              </button>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as 'all' | 'thisMonth' | 'custom')}
                className="flex items-center gap-2 rounded-xl h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-emerald-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom</option>
              </select>
              <button
                  onClick={handleGenerateReport}
                  className="flex items-center gap-2 rounded-xl h-10 px-4 bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                  <FileText size={18} />
                  <span>Generate Report</span>
              </button>
            </div>
          </div>
          {timeRange === 'custom' && (
            <div className="flex flex-wrap items-start gap-2 justify-end">
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-emerald-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-xl h-10 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-emerald-50 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  />
                </div>
                {dateError && <p className="text-red-500 text-xs font-semibold">{dateError}</p>}
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
          <AnimatedStatCard
            label="Total Users"
            value={totalUsers ?? 0}
            icon={Users}
            color="emerald"
            caption="Registered accounts"
            sparkline={userRecords ? usersDailySeries : undefined}
            trendPercent={usersTrendPercent}
          />

          <AnimatedStatCard
            label="Total Products"
            value={productsAnalytics.totalProducts}
            icon={Box}
            color="orange"
            caption={`Total stock: ${productsAnalytics.totalStock}`}
          />

          <AnimatedStatCard
            label="Total Categories"
            value={categoriesAnalytics.totalCategories}
            icon={Folder}
            color="blue"
            caption={`Total sub-sections: ${categoriesAnalytics.totalSubSections}`}
          />

          <AnimatedStatCard
            label="Total Orders"
            value={ordersAnalytics.totalOrders}
            icon={ClipboardList}
            color="purple"
            caption={`Revenue: ${getFormattedPrice(ordersAnalytics.deliveredOrdersRevenue)}`}
            sparkline={ordersDailySeries}
            trendPercent={ordersTrendPercent}
          />

          <AnimatedStatCard
            label="Total Revenue"
            value={totalRevenue}
            formatValue={getFormattedPrice}
            icon={Wallet}
            color="amber"
            caption="Confirmed payments only"
            sparkline={revenueDailySeries}
            trendPercent={revenueTrendPercent}
          />
        </div>



        <CategoryPerformanceChart />

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-300">
          <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50">Category Split</h3>
          <p className="text-sm text-slate-400 dark:text-slate-400 font-medium mb-8">Revenue breakdown by category - hover a slice for details</p>
          <div className="flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height={isMobile ? 420 : 480}>
              <PieChart>
                <Pie
                  data={dynamicCategoryPieData}
                  cx="50%"
                  cy={isMobile ? '38%' : '50%'}
                  innerRadius={isMobile ? 60 : 98}
                  outerRadius={isMobile ? 95 : 155}
                  paddingAngle={3}
                  cornerRadius={6}
                  dataKey="value"
                  nameKey="name"
                  activeShape={renderActiveCategorySlice}
                  onMouseEnter={(_data, index) => setActiveCategorySlice(index)}
                  onMouseLeave={() => setActiveCategorySlice(null)}
                >
                  {dynamicCategoryPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                {/* Default center label - hidden while a slice is active, since the active shape shows its own detail there instead */}
                {activeCategorySlice === null && (
                  <>
                    <text x="50%" y={isMobile ? '35%' : '47%'} textAnchor="middle" fill={chartColors.tickFill} fontSize={12} fontWeight={700} className="uppercase tracking-widest">
                      Total
                    </text>
                    <text x="50%" y={isMobile ? '43%' : '55%'} textAnchor="middle" fill={chartColors.pieLabelFill} fontSize={isMobile ? 16 : 22} fontWeight={900}>
                      {getFormattedPrice(totalPieValue)}
                    </text>
                  </>
                )}
                <Tooltip
                   contentStyle={{borderRadius: '1.5rem', border: chartColors.tooltipBorder, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1rem', background: chartColors.tooltipBg}}
                   itemStyle={{color: chartColors.pieLabelFill}}
                   labelStyle={{color: chartColors.pieLabelFill}}
                   formatter={((value: any, name: any, entry: any) => {
                     const v = Number(value) || 0;
                     return [`${getFormattedPrice(v)} (${((v / totalPieValue) * 100).toFixed(1)}%)`, name];
                   }) as any}
                />
                {isMobile ? (
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ width: '100%', fontSize: '12px', paddingTop: 12 }}
                    content={<CustomPieLegend chartData={dynamicCategoryPieData} totalPieValue={totalPieValue} getFormattedPrice={getFormattedPrice} />}
                  />
                ) : (
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ right: 0, width: '30%', fontSize: '15px', lineHeight: '28px' }}
                    content={<CustomPieLegend chartData={dynamicCategoryPieData} totalPieValue={totalPieValue} getFormattedPrice={getFormattedPrice} />}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 sm:p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-300">
            <div className="flex items-start justify-between gap-2 mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50">Top-Selling Products</h3>
                <p className="text-sm text-slate-400 dark:text-slate-400 font-medium">Ranked by revenue</p>
              </div>
              <Link to="/admin/products" className="text-emerald-600 dark:text-emerald-400 text-sm font-bold hover:underline whitespace-nowrap">
                View all products
              </Link>
            </div>
            {topProducts.length === 0 ? (
              <div className="flex-grow flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">No sales yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: isMobile ? 8 : 24, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke={chartColors.gridStroke} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartColors.tickFill, fontSize: isMobile ? 10 : 12, fontWeight: 600 }}
                    tickFormatter={(value) => getFormattedPrice(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 90 : 140}
                    tick={(props: any) => <ProductNameTick {...props} colors={topProductColors} maxLineLength={isMobile ? 10 : 15} />}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                    // maxWidth + wordBreak stop a long product name from stretching the tooltip
                    // wider than the chart (and past the screen edge on mobile) - it wraps onto a
                    // couple of lines within a fixed width instead.
                    contentStyle={{
                      borderRadius: '1.5rem', border: chartColors.tooltipBorder, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '1rem', background: chartColors.tooltipBg, maxWidth: 220, wordBreak: 'break-word', whiteSpace: 'normal',
                    }}
                    itemStyle={{ color: chartColors.pieLabelFill }}
                    labelStyle={{ color: chartColors.pieLabelFill, fontWeight: 700, marginBottom: '0.25rem', whiteSpace: 'normal', wordBreak: 'break-word' }}
                    formatter={((value: any, _name: any, entry: any) => [
                      `${getFormattedPrice(Number(value) || 0)} (${entry.payload.unitsSold} sold)`, 'Revenue'
                    ]) as any}
                  />
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} barSize={28}>
                    {topProducts.map((_entry, index) => (
                      <Cell key={`bar-${index}`} fill={topProductColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        <div className="bg-orange-50 dark:bg-slate-900 rounded-[2.5rem] border border-orange-100 dark:border-slate-800 shadow-sm overflow-hidden" id="inventory-report">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-orange-100 dark:border-slate-800 bg-orange-50 dark:bg-slate-900">
            <h2 className="text-slate-900 dark:text-emerald-50 text-lg font-bold">Inventory Overview</h2>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>

          {/* Stock-level filter (with live counts so a glance shows how much needs restocking)
              plus an optional category filter - both scoped to each other so switching category
              re-counts the pills against just that category's products. */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-orange-100 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'in', label: 'In Stock' },
                { key: 'low', label: 'Low Stock' },
                { key: 'out', label: 'Out of Stock' },
              ] as const).map(({ key, label }) => {
                const scoped = inventoryCategoryFilter === 'all' ? products : products.filter(p => p.category === inventoryCategoryFilter);
                const count = key === 'all' ? scoped.length : scoped.filter(p => inventoryStockTier(p.stock) === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setInventoryStockFilter(key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${inventoryStockFilter === key ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {label} <span className="opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
            <select
              value={inventoryCategoryFilter}
              onChange={(e) => setInventoryCategoryFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold outline-none text-slate-700 dark:text-emerald-100"
            >
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Product</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Price</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Stock</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedInventory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No products match this filter.
                    </td>
                  </tr>
                )}
                {paginatedInventory.map((product) => {
                  const tier = inventoryStockTier(product.stock);
                  const tierStyle = tier === 'out'
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                    : tier === 'low'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300';
                  const tierLabel = tier === 'out' ? 'Out of Stock' : tier === 'low' ? 'Low Stock' : 'In Stock';
                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-medium text-slate-900 dark:text-emerald-50 line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-emerald-200">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-900 dark:text-emerald-100">{getFormattedPrice(product.price)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-900 dark:text-emerald-100">{product.stock}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${tierStyle}`}>
                          {tierLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination
            currentPage={inventoryPage}
            totalPages={inventoryTotalPages}
            onPageChange={setInventoryPage}
            totalItems={filteredInventory.length}
            itemsPerPage={INVENTORY_PER_PAGE}
            itemLabel="products"
          />
        </div>
      </div>
    </>
  );
}
