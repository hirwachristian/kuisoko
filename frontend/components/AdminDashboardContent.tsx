
import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector, BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import {
  LayoutDashboard, Users, Receipt, Calendar, Plus, ArrowUpRight, Zap,
  Box, Folder, ClipboardList, Package, Printer, Download, Wallet, RefreshCw, FileText, Bell
} from 'lucide-react';
import { ORDER_STATUS_COLORS } from '../constants';
import { useAppContext } from '../context/AppContext';
import { apiFetch } from '../api';
import CategoryPerformanceChart from './CategoryPerformanceChart';
import KuISOKOLogoSVG from './KuISOKOLogoSVG';
import NotificationPanel from './NotificationPanel';

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
  const { x, y, payload, index, colors } = props;
  const lines = wrapProductName(payload.value);
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
  const { user, token, logout, categories, products, orders, getFormattedPrice, categoryHierarchy, unreadNotificationCount } = useAppContext();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'annually'>('daily');
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [timeRange, setTimeRange] = useState<'all' | 'thisMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [activeCategorySlice, setActiveCategorySlice] = useState<number | null>(null);
  const location = useLocation();

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
        const { users } = await apiFetch<{ users: unknown[] }>('/users', {}, token);
        if (!cancelled) setTotalUsers(users.length);
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
    // Normalize times for comparison
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

  const handleDownloadReport = () => {
    // Combine overall website data for the report
    const data = [
      ['Metric', 'Value'],
      ['Total Products', products.length],
      ['Total Orders', orders.length],
      ['Total Categories', categories.length],
      ['Total Revenue', orders.reduce((sum, order) => sum + order.total, 0)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + data.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "overall_website_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Derived Analytics for new cards
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

  // Calculate total for percentage in legend
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
            <div style={{ marginTop: '40px', fontSize: '13px', color: '#666' }}>
              <p><strong>Issued by:</strong> {user?.name || 'Admin'}</p>
              <p><strong>Email:</strong> {user?.email || 'admin@example.com'}</p>
            </div>
            <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: '2px solid #0B5D3B', textAlign: 'center' }}>
              <p style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px', color: '#0B5D3B' }}>KuISOKO</p>
              <p style={{ fontSize: '13px', margin: 0, color: '#888' }}>Generated by the KuISOKO Admin Dashboard.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Page Heading */}
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
              <button
                onClick={() => setShowNotifications(prev => !prev)}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
              </AnimatePresence>
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
      {/* Main Content Area */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Total Users Card */}
          <div className="flex flex-col gap-2 rounded-2xl p-6 bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 shadow-sm transition-colors duration-300">
            <div className="flex justify-between items-start">
              <p className="text-emerald-900 dark:text-emerald-200 text-sm font-semibold uppercase tracking-wider">Total Users</p>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                <Users size={20} />
              </div>
            </div>
            <p className="text-emerald-950 dark:text-white tracking-tight text-3xl font-black">{totalUsers ?? '—'}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 italic">Registered accounts</p>
          </div>

          {/* Products Overview Card */}
          <div className="flex flex-col gap-2 rounded-2xl p-6 bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 shadow-sm transition-colors duration-300">
            <div className="flex justify-between items-start">
              <p className="text-orange-900 dark:text-orange-200 text-sm font-semibold uppercase tracking-wider">Total Products</p>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-orange-900 flex items-center justify-center text-orange-700 dark:text-orange-300">
                <Box size={20} />
              </div>
            </div>
            <p className="text-orange-950 dark:text-white tracking-tight text-3xl font-black">{productsAnalytics.totalProducts}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 italic">Total stock: {productsAnalytics.totalStock}</p>
          </div>

          {/* Categories Overview Card */}
          <div className="flex flex-col gap-2 rounded-2xl p-6 bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 shadow-sm transition-colors duration-300">
            <div className="flex justify-between items-start">
              <p className="text-blue-900 dark:text-blue-200 text-sm font-semibold uppercase tracking-wider">Total Categories</p>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300">
                <Folder size={20} />
              </div>
            </div>
            <p className="text-blue-950 dark:text-white tracking-tight text-3xl font-black">{categoriesAnalytics.totalCategories}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 italic">Total sub-sections: {categoriesAnalytics.totalSubSections}</p>
          </div>

          {/* Orders Overview Card */}
          <div className="flex flex-col gap-2 rounded-2xl p-6 bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-900 shadow-sm transition-colors duration-300">
            <div className="flex justify-between items-start">
              <p className="text-purple-900 dark:text-purple-200 text-sm font-semibold uppercase tracking-wider">Total Orders</p>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300">
                <ClipboardList size={20} />
              </div>
            </div>
            <p className="text-purple-950 dark:text-white tracking-tight text-3xl font-black">{ordersAnalytics.totalOrders}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400 italic">Revenue: {getFormattedPrice(ordersAnalytics.deliveredOrdersRevenue)}</p>
          </div>

          {/* Total Revenue Card */}
          <div className="flex flex-col gap-2 rounded-2xl p-6 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 shadow-sm transition-colors duration-300">
            <div className="flex justify-between items-start">
              <p className="text-amber-900 dark:text-amber-200 text-sm font-semibold uppercase tracking-wider">Total Revenue</p>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300">
                <Wallet size={20} />
              </div>
            </div>
            <p className="text-amber-950 dark:text-white tracking-tight text-3xl font-black">{getFormattedPrice(totalRevenue)}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 italic">Confirmed payments only</p>
          </div>
        </div>



        {/* Revenue Analytics Chart */}
        <CategoryPerformanceChart />

        {/* Category Split Donut - large, full width, with hover detail and a live center total */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-300">
          <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50">Category Split</h3>
          <p className="text-sm text-slate-400 dark:text-slate-400 font-medium mb-8">Revenue breakdown by category - hover a slice for details</p>
          <div className="flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height={480}>
              <PieChart>
                <Pie
                  data={dynamicCategoryPieData}
                  cx="45%"
                  cy="50%"
                  innerRadius={98}
                  outerRadius={155}
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
                    <text x="45%" y="47%" textAnchor="middle" fill={chartColors.tickFill} fontSize={12} fontWeight={700} className="uppercase tracking-widest">
                      Total
                    </text>
                    <text x="45%" y="55%" textAnchor="middle" fill={chartColors.pieLabelFill} fontSize={22} fontWeight={900}>
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
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ right: 0, width: '30%', fontSize: '15px', lineHeight: '28px' }}
                  content={<CustomPieLegend chartData={dynamicCategoryPieData} totalPieValue={totalPieValue} getFormattedPrice={getFormattedPrice} />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top-Selling Products Section */}
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
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke={chartColors.gridStroke} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chartColors.tickFill, fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => getFormattedPrice(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={140}
                    tick={(props: any) => <ProductNameTick {...props} colors={topProductColors} />}
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

        {/* Inventory Overview Section */}
        <div className="bg-orange-50 dark:bg-slate-900 rounded-[2.5rem] border border-orange-100 dark:border-slate-800 shadow-sm overflow-hidden" id="inventory-report">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-orange-100 dark:border-slate-800 bg-orange-50 dark:bg-slate-900">
            <h2 className="text-slate-900 dark:text-emerald-50 text-lg font-bold">Inventory Overview</h2>
            <div className="flex flex-wrap items-center gap-3">
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none text-slate-700 dark:text-emerald-100"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
              {(reportType === 'monthly' || reportType === 'annually') && (
                <select 
                  value={reportYear}
                  onChange={(e) => setReportYear(parseInt(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none text-slate-700"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              )}
              <button 
                onClick={handleDownloadReport}
                className="flex items-center gap-2 rounded-lg px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <Download size={16} />
                <span>Download Report</span>
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
              >
                <Printer size={16} />
                <span>Print Report</span>
              </button>
            </div>
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
                {products.slice(0, 5).map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <p className="font-medium text-slate-900 dark:text-emerald-50 line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-emerald-200">{product.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-900 dark:text-emerald-100">{getFormattedPrice(product.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-900 dark:text-emerald-100">{product.stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${product.stock < 10 ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'}`}>
                        {product.stock < 10 ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
