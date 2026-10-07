import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Upload, Plus, Receipt, Package, DollarSign } from 'lucide-react'
import { COLORS_CHART } from '../lib/constants'
import { fmt } from '../lib/utils'
import { T, monoLabel, heroAmount } from '../lib/theme'
import { btnStyle, tooltipS } from '../lib/styles'
import { Card, Empty } from './shared'

// Barcode budget visualization — 90 vertical bars
function BudgetBarcode({ spent, total, mobile }) {
  const bars = 90
  const pct = total > 0 ? Math.min(1, spent / total) : 0
  const filledBars = Math.round(pct * bars)
  const overBudget = spent > total

  return (
    <div style={{ display: 'flex', gap: 1, height: mobile ? 40 : 56, alignItems: 'flex-end' }}>
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i < filledBars
        return (
          <div
            key={i}
            style={{
              width: 1,
              flex: 1,
              height: `${60 + Math.random() * 40}%`,
              background: filled
                ? (overBudget ? T.error : T.deepTeal)
                : `rgba(18,38,35,0.15)`,
              borderRadius: 0.5,
              transition: 'background 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}

// Stacked CTA card
function CTACard({ bg, color, title, subtitle, icon: Ic, onClick, style: extraStyle }) {
  return (
    <button onClick={onClick} style={{
      background: bg,
      color,
      border: 'none',
      borderRadius: T.radiusXl,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      cursor: 'pointer',
      fontFamily: T.fontSans,
      textAlign: 'left',
      ...extraStyle,
    }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: T.semibold }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 }}>
        <Ic size={20} />
      </div>
    </button>
  )
}

export default function Dashboard({ totalSpend, inventory, lowStock, monthTx, transactions, profile, setModal, setPage, mobile }) {
  const budget = profile.monthlyBudget || 0
  const pct = budget > 0 ? Math.min(100, (totalSpend / budget) * 100) : 0
  const remaining = Math.max(0, budget - totalSpend)

  const catSpend = {}
  monthTx.forEach(t => {
    catSpend[t.category || 'Other'] = (catSpend[t.category || 'Other'] || 0) + Number(t.price) * (Number(t.qty) || 1)
  })
  const pieData = Object.entries(catSpend).map(([name, value]) => ({ name, value: +value.toFixed(2) })).sort((a, b) => b.value - a.value).slice(0, 6)

  const recent = (transactions || []).slice(0, 5)

  // Initials for avatar
  const initials = (profile.name || 'PB').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header with avatar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ ...monoLabel, margin: 0 }}>YOUR HOUSEHOLD</p>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: T.teal, color: T.warm,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontMono, fontSize: 12, fontWeight: T.medium,
          letterSpacing: '0.5px',
        }}>
          {initials}
        </div>
      </div>

      {/* Hero Amount */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...heroAmount, fontSize: mobile ? 48 : 72 }}>{fmt(totalSpend)}</div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 0',
        marginBottom: 24,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...monoLabel, marginBottom: 4 }}>BUDGET</div>
          <div style={{ fontSize: 16, fontWeight: T.medium, color: T.text }}>{budget > 0 ? fmt(budget) : '—'}</div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
          <div style={{ ...monoLabel, marginBottom: 4 }}>REMAINING</div>
          <div style={{ fontSize: 16, fontWeight: T.medium, color: remaining > 0 ? T.success : T.error }}>{budget > 0 ? fmt(remaining) : '—'}</div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
          <div style={{ ...monoLabel, marginBottom: 4 }}>ITEMS</div>
          <div style={{ fontSize: 16, fontWeight: T.medium, color: T.text }}>{inventory.length}</div>
        </div>
      </div>

      {/* Budget Barcode */}
      {budget > 0 && (
        <div style={{ marginBottom: 24 }}>
          <BudgetBarcode spent={totalSpend} total={budget} mobile={mobile} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ ...monoLabel }}>{Math.round(pct)}% USED</span>
            <span style={{ ...monoLabel }}>{fmt(remaining)} LEFT</span>
          </div>
        </div>
      )}

      {/* Stacked CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
        <CTACard
          bg={T.amber}
          color={T.deepTeal}
          title="Quick Add"
          subtitle="Scan receipt or add manually"
          icon={Plus}
          onClick={() => setModal('manual')}
          style={{ zIndex: 2, position: 'relative', boxShadow: T.shadowMd }}
        />
        <CTACard
          bg={T.teal}
          color={T.warm}
          title="Shopping List"
          subtitle={`${lowStock.length} items to restock`}
          icon={Receipt}
          onClick={() => setPage('shopping')}
          style={{ marginTop: -12, paddingTop: 28, zIndex: 1 }}
        />
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div style={{
          background: `${T.warning}12`,
          border: `1px solid ${T.warning}30`,
          borderRadius: T.radiusMd,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: T.warning }} />
            <span style={{ color: T.text, fontSize: 14, fontWeight: T.medium }}>
              {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} running low
            </span>
          </div>
          <button onClick={() => setPage('inventory')} style={{
            background: `${T.warning}18`,
            color: T.text,
            border: `1px solid ${T.warning}30`,
            borderRadius: 6,
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: T.medium,
            fontFamily: T.fontSans,
          }}>
            View
          </button>
        </div>
      )}

      {/* Two-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Spending by Category */}
        <Card title="SPENDING BY CATEGORY">
          {pieData.length === 0 ? (
            <Empty msg="No spending data this month" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS_CHART[i % COLORS_CHART.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipS} formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textMuted }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_CHART[i % COLORS_CHART.length] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card title="RECENT TRANSACTIONS">
          {recent.length === 0 ? (
            <Empty msg="No transactions yet" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((t, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < recent.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: T.text, fontWeight: T.medium }}>{t.item}</div>
                    <div style={{ fontSize: 12, color: T.textLight }}>{t.store}{t.date ? ` · ${t.date}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, color: T.text, fontWeight: T.semibold }}>{fmt(Number(t.price) * (Number(t.qty) || 1))}</div>
                    {Number(t.qty) > 1 && <div style={{ fontSize: 11, color: T.textLight }}>x{t.qty}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
