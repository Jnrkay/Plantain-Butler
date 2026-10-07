import React, { useMemo } from 'react';
import { fmt, monthKey } from '../lib/utils';
import { T, monoLabel } from '../lib/theme';
import { Card, Empty } from './shared';
import { BarChart3, MoreHorizontal, ChevronDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const AMBER = T.amber;
const TEAL = T.teal;
const CREAM = T.cream;
const GREEN = T.success;

const pill = (bg, color) => ({
  ...monoLabel,
  background: bg,
  color: color,
  padding: '5px 12px',
  borderRadius: T.radiusPill,
  display: 'inline-block',
  fontSize: 10,
  lineHeight: 1,
});

function Sparkline({ points, color = AMBER, width = 60, height = 24 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AnalyticsPage({ transactions, budgets, profile, mobile }) {
  const now = new Date();
  const currentMonthKey = monthKey(now);
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthName = now.toLocaleString('en', { month: 'short', year: 'numeric' });

  // Current month transactions
  const monthTxns = useMemo(() =>
    transactions.filter(t => monthKey(new Date(t.date)) === currentMonthKey),
    [transactions, currentMonthKey]
  );

  const totalSpend = useMemo(() =>
    monthTxns.reduce((s, t) => s + t.price * t.qty, 0),
    [monthTxns]
  );

  // Budget
  const monthlyBudget = budgets?.monthly || 2000;
  const paceToday = (monthlyBudget / daysInMonth) * currentDay;
  const underPace = paceToday - totalSpend;

  // Weekly spending data for bar chart
  const weeklyData = useMemo(() => {
    const buckets = [
      { label: '01', start: 1, end: 7 },
      { label: '08', start: 8, end: 14 },
      { label: '15', start: 15, end: 21 },
      { label: '22', start: 22, end: 28 },
      { label: '31', start: 29, end: 31 },
    ];
    return buckets.map(b => {
      const spend = monthTxns
        .filter(t => {
          const day = new Date(t.date).getDate();
          return day >= b.start && day <= b.end;
        })
        .reduce((s, t) => s + t.price * t.qty, 0);
      const pace = (monthlyBudget / daysInMonth) * b.end;
      return { name: b.label, spend, pace };
    });
  }, [monthTxns, monthlyBudget, daysInMonth]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const catMap = {};
    monthTxns.forEach(t => {
      const c = t.category || 'Other';
      catMap[c] = (catMap[c] || 0) + t.price * t.qty;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  const categoryTotal = categoryData.reduce((s, c) => s + c.value, 0) || 1;
  const categoryColors = [AMBER, TEAL, T.warm, T.deepTeal, T.textMuted];

  // Price changes — group by item, compare first vs last purchase
  const priceChanges = useMemo(() => {
    const itemMap = {};
    // Use all transactions for history, sorted by date
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(t => {
      const key = t.item || t.name;
      if (!key) return;
      if (!itemMap[key]) itemMap[key] = { name: key, store: t.store, purchases: [] };
      itemMap[key].purchases.push({ price: t.price, date: t.date, qty: t.qty });
      if (t.store) itemMap[key].store = t.store;
    });
    return Object.values(itemMap)
      .filter(item => item.purchases.length >= 2)
      .map(item => {
        const first = item.purchases[0];
        const last = item.purchases[item.purchases.length - 1];
        const change = ((last.price - first.price) / first.price) * 100;
        return {
          name: item.name,
          store: item.store || '',
          count: item.purchases.length,
          firstPrice: first.price,
          lastPrice: last.price,
          change,
          sparkPoints: item.purchases.map(p => p.price),
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [transactions]);

  if (!transactions.length) {
    return <Empty icon={BarChart3} message="No data yet" />;
  }

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: T.surfaceDeep, color: T.warm, padding: '8px 12px',
        borderRadius: T.radiusSm, fontSize: 12, boxShadow: T.shadowMd,
      }}>
        <div style={{ fontWeight: T.semibold, marginBottom: 2 }}>Week of {label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.dataKey === 'spend' ? AMBER : T.warm }}>
            {p.dataKey === 'spend' ? 'Spent' : 'Pace'}: {fmt(p.value)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      padding: mobile ? '20px 16px 100px' : '32px 40px 60px',
      maxWidth: 600,
      margin: '0 auto',
      fontFamily: T.fontSans,
    }}>

      {/* Header: Avatar + menu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: TEAL,
          color: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: T.semibold, fontFamily: T.fontSans,
        }}>
          {profile?.initials || 'ED'}
        </div>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: T.text, display: 'flex',
        }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{
          margin: 0, fontSize: 28, fontWeight: T.semibold, color: T.text,
          fontFamily: T.fontSans,
        }}>
          Insights
        </h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          border: `1px solid ${T.border}`, borderRadius: T.radiusPill,
          padding: '6px 14px 6px 16px', fontSize: 13, color: T.text,
          fontWeight: T.medium, fontFamily: T.fontSans,
        }}>
          {monthName}
          <ChevronDown size={14} style={{ opacity: 0.5 }} />
        </div>
      </div>

      {/* Spent So Far */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 14 }}>
          <span style={pill('#005250', CREAM)}>SPENT SO FAR</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{
              fontSize: 14, color: T.textMuted, fontWeight: T.regular,
              fontFamily: T.fontSans, marginRight: 4,
            }}>
              GHS
            </span>
            <span style={{
              fontSize: 56, fontWeight: T.light, color: T.text,
              fontFamily: T.fontSans, letterSpacing: '-2px', lineHeight: 1,
            }}>
              {totalSpend.toFixed(2)}
            </span>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: 6 }}>
            <div style={{
              fontSize: 15, fontWeight: T.semibold, color: T.text,
              fontFamily: T.fontSans,
            }}>
              {Math.abs(underPace).toFixed(2)} {underPace >= 0 ? 'under' : 'over'} pace
            </div>
            <div style={{
              fontSize: 12, color: T.textMuted, fontFamily: T.fontSans, marginTop: 2,
            }}>
              Pace today: {fmt(paceToday)}
            </div>
          </div>
        </div>
      </div>

      {/* Spending chart */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} barCategoryGap="25%">
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: T.textLight, fontSize: 11, fontFamily: T.fontMono }}
            />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(18,38,35,0.04)' }} />
            <ReferenceLine
              y={monthlyBudget / 5}
              stroke={T.textLight}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="spend" fill={AMBER} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, paddingLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: AMBER, display: 'inline-block' }} />
            Your spend
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMuted }}>
            <span style={{ width: 16, height: 0, borderTop: `2px dashed ${T.textLight}`, display: 'inline-block' }} />
            Budget pace ({fmt(monthlyBudget)})
          </div>
        </div>
      </Card>

      {/* By Category */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={monoLabel}>BY CATEGORY</span>
          <span style={monoLabel}>{categoryData.length} CATEGOR{categoryData.length === 1 ? 'Y' : 'IES'}</span>
        </div>

        {/* Stacked horizontal bar */}
        <div style={{
          display: 'flex', borderRadius: T.radiusSm, overflow: 'hidden',
          height: 32, marginBottom: 10,
        }}>
          {categoryData.map((cat, i) => {
            const pct = (cat.value / categoryTotal) * 100;
            return (
              <div key={cat.name} style={{
                width: `${pct}%`, background: categoryColors[i % categoryColors.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: T.semibold,
                color: i === 0 ? T.deepTeal : CREAM,
                minWidth: pct > 8 ? undefined : 0,
              }}>
                {pct >= 12 ? `${Math.round(pct)}%` : ''}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {categoryData.map((cat, i) => (
            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: categoryColors[i % categoryColors.length],
                display: 'inline-block',
              }} />
              {cat.name} {cat.value.toFixed(2)}
            </div>
          ))}
        </div>
      </div>

      {/* Price Changes */}
      {priceChanges.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={monoLabel}>PRICE CHANGES</span>
            <span style={{ ...monoLabel, color: AMBER }}>SAMPLE HISTORY</span>
          </div>

          {priceChanges.map((item, idx) => {
            const isUp = item.change > 0;
            const isFlat = item.change === 0;
            const badgeColor = isFlat ? T.textMuted : isUp ? AMBER : GREEN;
            const arrow = isFlat ? '—' : isUp ? '▲' : '▼';
            const isHero = idx === 0;

            if (isHero) {
              return (
                <div key={item.name} style={{
                  background: '#005250',
                  borderRadius: T.radiusLg,
                  padding: 16,
                  marginBottom: 12,
                  border: `1px solid ${T.borderLight}`,
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{
                      fontSize: 15, fontWeight: T.semibold, color: CREAM,
                      fontFamily: T.fontSans, marginBottom: 4,
                    }}>
                      {item.name}
                    </div>
                    <div style={{
                      ...monoLabel,
                      color: T.textOnTealMuted,
                    }}>
                      {item.count} PURCHASES{item.store ? ` · ${item.store.toUpperCase()}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{
                        fontSize: 36, fontWeight: T.light, color: CREAM,
                        fontFamily: T.fontSans, letterSpacing: '-1px', lineHeight: 1,
                      }}>
                        {item.lastPrice.toFixed(2)}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: T.semibold, color: T.deepTeal,
                        background: AMBER,
                        padding: '3px 8px', borderRadius: T.radiusPill,
                      }}>
                        {arrow} {Math.abs(item.change).toFixed(1)}%
                      </span>
                    </div>
                    <Sparkline
                      points={item.sparkPoints}
                      color={AMBER}
                      width={72}
                      height={28}
                    />
                  </div>
                </div>
              );
            }

            return (
              <Card key={item.name} style={{ marginBottom: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: T.medium, color: T.text,
                      fontFamily: T.fontSans, marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      GHS {item.firstPrice.toFixed(2)} &rarr; {item.lastPrice.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <Sparkline
                      points={item.sparkPoints}
                      color={isFlat ? T.textMuted : isUp ? AMBER : GREEN}
                      width={48}
                      height={20}
                    />
                    <span style={{
                      fontSize: 11, fontWeight: T.semibold, color: badgeColor,
                      background: `${isFlat ? T.textMuted : badgeColor}18`,
                      padding: '3px 8px', borderRadius: T.radiusPill,
                      whiteSpace: 'nowrap',
                    }}>
                      {arrow} {Math.abs(item.change).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
