import React from 'react';
import { COLORS_CHART } from '../lib/constants';
import { fmt, monthKey, monthLabel } from '../lib/utils';
import { tooltipS } from '../lib/styles';
import { T, monoLabel } from '../lib/theme';
import { Card, Empty } from './shared';
import { BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

export default function AnalyticsPage({ transactions, mobile }) {
  // Monthly trend — last 6 months
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mk = monthKey(d);
    const total = transactions
      .filter(t => monthKey(new Date(t.date)) === mk)
      .reduce((s, t) => s + t.price * t.qty, 0);
    monthlyTrend.push({ month: monthLabel(d), total });
  }

  // Category totals
  const catMap = {};
  transactions.forEach(t => {
    const c = t.category || 'Other';
    catMap[c] = (catMap[c] || 0) + t.price * t.qty;
  });
  const categoryData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Store totals (top 8)
  const storeMap = {};
  transactions.forEach(t => {
    const s = t.store || 'Unknown';
    storeMap[s] = (storeMap[s] || 0) + t.price * t.qty;
  });
  const storeData = Object.entries(storeMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (!transactions.length) {
    return <Empty icon={BarChart3} message="No data yet" />;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipS}>
        <div style={{ color: T.warm, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || T.amber }}>
            {fmt(p.value)}
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipS}>
        <div style={{ color: T.warm, fontWeight: 600 }}>{payload[0].name}</div>
        <div style={{ color: T.amber }}>{fmt(payload[0].value)}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ ...monoLabel, display: 'block', marginBottom: 4 }}>Overview</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: T.semibold, color: T.text, fontFamily: T.fontSans }}>
          Analytics
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Monthly Trend — spans 2 cols on desktop */}
        <Card title="Monthly Trend" style={{ gridColumn: mobile ? undefined : '1 / -1' }}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.teal} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} />
              <XAxis dataKey="month" tick={{ fill: T.textLight, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₵${v}`} tick={{ fill: T.textLight, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={T.teal}
                strokeWidth={2}
                fill="url(#tealGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* By Category */}
        <Card title="By Category">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {categoryData.map((c, i) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 3,
                  backgroundColor: COLORS_CHART[i % COLORS_CHART.length],
                  display: 'inline-block',
                }} />
                {c.name}
              </div>
            ))}
          </div>
        </Card>

        {/* By Store */}
        <Card title="By Store">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={storeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} horizontal={false} />
              <XAxis type="number" tickFormatter={v => `₵${v}`} tick={{ fill: T.textLight, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={T.amber} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
