import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  DollarSign,
  Package,
  AlertTriangle,
  Upload,
  Plus,
  Receipt,
} from "lucide-react";
import { COLORS_CHART } from "../lib/constants";
import { fmt } from "../lib/utils";
import { btnStyle, btnPrimary, tooltipS } from "../lib/styles";
import { Card, StatCard, Empty } from "./shared";

export default function Dashboard({
  totalSpend,
  inventory,
  lowStock,
  monthTx,
  transactions,
  profile,
  setModal,
  setPage,
  mobile,
}) {
  const budget = profile.monthlyBudget || 0;
  const pct = budget > 0 ? Math.min(100, (totalSpend / budget) * 100) : 0;

  const catSpend = {};
  monthTx.forEach((t) => {
    catSpend[t.category || "Other"] =
      (catSpend[t.category || "Other"] || 0) +
      Number(t.price) * (Number(t.qty) || 1);
  });
  const pieData = Object.entries(catSpend)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const recent = (transactions || []).slice(0, 5);

  const barColor = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#06b6d4";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: mobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: mobile ? "stretch" : "center",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#e2e8f0",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 14 }}>
            Your household at a glance
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexDirection: "row",
            ...(mobile ? { width: "100%" } : {}),
          }}
        >
          <button
            onClick={() => setModal("receipt")}
            style={{
              ...btnStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(mobile ? { flex: 1 } : {}),
            }}
          >
            <Upload size={16} /> Receipt
          </button>
          <button
            onClick={() => setModal("manual")}
            style={{
              ...btnPrimary,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(mobile ? { flex: 1 } : {}),
            }}
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
            <span style={{ color: "#f59e0b", fontSize: 14, fontWeight: 500 }}>
              {lowStock.length} item{lowStock.length !== 1 ? "s" : ""} running
              low
            </span>
          </div>
          <button
            onClick={() => setPage("inventory")}
            style={{
              background: "rgba(245,158,11,0.15)",
              color: "#f59e0b",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            View
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <StatCard
          label="Spent"
          value={fmt(totalSpend)}
          sub={
            budget > 0 ? `${Math.round(pct)}% of budget` : "No budget"
          }
          color="#06b6d4"
          icon={DollarSign}
          mobile={mobile}
        />
        <StatCard
          label="In Stock"
          value={inventory.filter((i) => i.status === "high").length}
          sub={`${inventory.length} tracked`}
          color="#10b981"
          icon={Package}
          mobile={mobile}
        />
        <StatCard
          label="Low Stock"
          value={lowStock.length}
          sub="Needs restock"
          color="#f59e0b"
          icon={AlertTriangle}
          mobile={mobile}
        />
        <StatCard
          label="This Month"
          value={monthTx.length}
          sub="transactions"
          color="#8b5cf6"
          icon={Receipt}
          mobile={mobile}
        />
      </div>

      {/* Two-Column Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Budget Progress */}
        {budget > 0 && (
          <Card>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#e2e8f0",
                margin: "0 0 16px",
              }}
            >
              Budget Progress
            </h3>
            <div
              style={{
                background: "#1e2030",
                borderRadius: 8,
                height: 12,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: barColor,
                  borderRadius: 8,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#94a3b8" }}>
                {fmt(totalSpend)} of {fmt(budget)}
              </span>
              <span style={{ color: barColor, fontWeight: 600 }}>
                {fmt(Math.max(0, budget - totalSpend))} remaining
              </span>
            </div>
          </Card>
        )}

        {/* Spending by Category */}
        <Card>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#e2e8f0",
              margin: "0 0 16px",
            }}
          >
            Spending by Category
          </h3>
          {pieData.length === 0 ? (
            <Empty msg="No spending data this month" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORS_CHART[i % COLORS_CHART.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipS}
                    formatter={(v) => fmt(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 14px",
                  marginTop: 8,
                }}
              >
                {pieData.map((d, i) => (
                  <div
                    key={d.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#94a3b8",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS_CHART[i % COLORS_CHART.length],
                      }}
                    />
                    {d.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#e2e8f0",
              margin: "0 0 16px",
            }}
          >
            Recent Transactions
          </h3>
          {recent.length === 0 ? (
            <Empty msg="No transactions yet" />
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {recent.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom:
                      i < recent.length - 1
                        ? "1px solid #1e2030"
                        : "none",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#e2e8f0",
                        fontWeight: 500,
                      }}
                    >
                      {t.item}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {t.store}
                      {t.date ? ` · ${t.date}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#e2e8f0",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(Number(t.price) * (Number(t.qty) || 1))}
                    </div>
                    {Number(t.qty) > 1 && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        x{t.qty}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
