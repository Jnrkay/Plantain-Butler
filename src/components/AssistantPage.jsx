import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Mic, MoreHorizontal } from 'lucide-react';
import { STOCK_STATUS } from '../lib/constants';
import { fmt, today, monthKey } from '../lib/utils';
import { T, monoLabel } from '../lib/theme';

/* ------------------------------------------------------------------ */
/*  Category barcode visualization for inside assistant bubbles        */
/* ------------------------------------------------------------------ */
function CategoryBarcode({ categories }) {
  // categories: [{ name, amount, color }]
  const barCount = 60;
  const heights = useMemo(() =>
    Array.from({ length: barCount }, (_, i) => {
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return 50 + (seed - Math.floor(seed)) * 50;
    }), [barCount]);

  // Split bars roughly proportionally between categories
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const splits = categories.map(c => Math.max(4, Math.round((c.amount / (total || 1)) * barCount)));

  return (
    <div style={{ marginTop: 14, marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 1, height: 36, alignItems: 'flex-end' }}>
        {heights.map((h, i) => {
          // Determine which category this bar belongs to
          let catIdx = 0;
          let acc = 0;
          for (let c = 0; c < splits.length; c++) {
            acc += splits[c];
            if (i < acc) { catIdx = c; break; }
          }
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                backgroundColor: categories[catIdx]?.color || T.warm,
                borderRadius: 0.5,
              }}
            />
          );
        })}
      </div>
      {/* Category labels */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {categories.map((cat, i) => (
          <span
            key={i}
            style={{
              fontFamily: T.fontMono,
              fontSize: 10,
              fontWeight: T.medium,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: cat.color,
            }}
          >
            {cat.name} {Math.round(cat.amount)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Initial message & suggestion chips                                 */
/* ------------------------------------------------------------------ */
const INITIAL_MSG = {
  role: 'assistant',
  content: "Here's a quick look at your top spending categories this month.",
  showBarcode: true,
};

const SUGGESTION_CHIPS = [
  'This month vs last',
  'Optimise budget',
];

/* ------------------------------------------------------------------ */
/*  AssistantPage                                                       */
/* ------------------------------------------------------------------ */
export default function AssistantPage({ transactions, inventory, profile, mobile }) {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* ---------- Build top-2 categories for barcode viz ---------- */
  const topCategories = useMemo(() => {
    const catTotals = {};
    const mk = monthKey(new Date());
    transactions
      .filter(t => monthKey(new Date(t.date)) === mk)
      .forEach(t => {
        const c = t.category || 'Other';
        catTotals[c] = (catTotals[c] || 0) + t.price * t.qty;
      });
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const colors = [T.amber, 'rgba(244,221,211,0.85)'];
    return sorted.slice(0, 2).map(([name, amount], i) => ({
      name,
      amount,
      color: colors[i] || colors[1],
    }));
  }, [transactions]);

  /* ---------- System context builder ---------- */
  const buildContext = () => {
    const mk = monthKey(new Date());
    const monthTx = transactions.filter(t => monthKey(new Date(t.date)) === mk);
    const monthTotal = monthTx.reduce((s, t) => s + t.price * t.qty, 0);

    const invSlice = inventory.slice(0, 30).map(i =>
      `${i.name}: ${i.qty} ${i.unit || ''} (${STOCK_STATUS[i.status]?.label || i.status})`
    ).join('\n');

    const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'out')
      .map(i => `${i.name} (${STOCK_STATUS[i.status]?.label || i.status})`).join(', ');

    const recentTx = transactions.slice(-20).map(t =>
      `${t.date} | ${t.name} | ${fmt(t.price)} x${t.qty} | ${t.category} | ${t.store}`
    ).join('\n');

    const catTotals = {};
    transactions.forEach(t => {
      const c = t.category || 'Other';
      catTotals[c] = (catTotals[c] || 0) + t.price * t.qty;
    });
    const catSummary = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${c}: ${fmt(v)}`)
      .join(', ');

    return `You are Plantain Butler, a Ghanaian household finance assistant. Use Ghanaian Cedi (₵). Today is ${today()}.

Profile: ${profile?.name || 'User'}, budget: ${fmt(profile?.budget || 0)}/month, household: ${profile?.household || 1}.

This month: ${fmt(monthTotal)} spent across ${monthTx.length} transactions.

Inventory (first 30):
${invSlice || 'No items'}

Low/out of stock: ${lowStock || 'None'}

Recent transactions:
${recentTx || 'None'}

Category totals (all time): ${catSummary || 'None'}

Be helpful, concise, and practical. Format currency as ₵X.XX.`;
  };

  /* ---------- Send message ---------- */
  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = updated
        .slice(1)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-5-5',
          max_tokens: 1000,
          system: buildContext(),
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Sorry, I could not process that.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const send = () => sendMessage(input);
  const handleChipClick = (chipText) => sendMessage(chipText);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: mobile ? 'calc(100vh - 100px)' : 'calc(100vh - 48px)',
      backgroundColor: T.surface,
      fontFamily: T.fontSans,
      padding: '0 16px',
    }}>

      {/* ---- Header row: avatar + three-dots ---- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0 12px',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: T.teal,
          color: T.cream,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: T.semibold,
          fontFamily: T.fontSans,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}>
          ED
        </div>
        <button style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: T.textMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }} aria-label="Menu">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* ---- Title ---- */}
      <div style={{
        fontSize: 28,
        color: T.deepTeal,
        fontFamily: T.fontSans,
        fontWeight: T.regular,
        margin: '0 0 16px',
        lineHeight: 1.2,
      }}>
        Ask your <span style={{ fontWeight: T.semibold }}>Butler</span>
      </div>

      {/* ---- Chat area ---- */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map((m, i) => (
          m.role === 'user' ? (
            /* ---- User bubble ---- */
            <div key={i} style={{
              alignSelf: 'flex-end',
              backgroundColor: '#ffffff',
              color: T.text,
              border: `1px solid ${T.borderLight}`,
              borderRadius: `${T.radiusMd}px ${T.radiusMd}px 4px ${T.radiusMd}px`,
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: T.fontSans,
              maxWidth: '80%',
            }}>
              {m.content}
            </div>
          ) : (
            /* ---- Assistant bubble ---- */
            <div key={i} style={{
              alignSelf: 'flex-start',
              backgroundColor: T.teal,
              color: T.warm,
              borderRadius: `${T.radiusMd}px ${T.radiusMd}px ${T.radiusMd}px 4px`,
              padding: '12px 14px',
              fontSize: 14,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: T.fontSans,
              width: '100%',
              boxSizing: 'border-box',
            }}>
              {/* PLANTAIN BUTLER mono label */}
              <span style={{
                ...monoLabel,
                color: T.textOnTealMuted,
                marginBottom: 6,
                display: 'block',
              }}>
                PLANTAIN BUTLER
              </span>

              {/* Message content */}
              {m.error ? (
                <span style={{ color: T.error }}>{m.content}</span>
              ) : (
                m.content
              )}

              {/* Barcode visualization for initial message */}
              {m.showBarcode && topCategories.length > 0 && (
                <CategoryBarcode categories={topCategories} />
              )}

              {/* Action buttons inside assistant bubble */}
              {m.showBarcode && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 12,
                }}>
                  <button style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    fontFamily: T.fontSans,
                    fontWeight: T.medium,
                    color: T.amber,
                    backgroundColor: 'transparent',
                    border: `1px solid ${T.amber}`,
                    borderRadius: T.radiusPill,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    + Add to list
                  </button>
                  <button style={{
                    padding: '7px 16px',
                    fontSize: 13,
                    fontFamily: T.fontSans,
                    fontWeight: T.medium,
                    color: T.warm,
                    backgroundColor: 'transparent',
                    border: `1px solid rgba(244,221,211,0.4)`,
                    borderRadius: T.radiusPill,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    Not now
                  </button>
                </div>
              )}
            </div>
          )
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            backgroundColor: T.teal,
            color: T.warm,
            borderRadius: `${T.radiusMd}px ${T.radiusMd}px ${T.radiusMd}px 4px`,
            padding: '12px 14px',
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: T.fontSans,
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <span style={{
              ...monoLabel,
              color: T.textOnTealMuted,
              marginBottom: 6,
              display: 'block',
            }}>
              PLANTAIN BUTLER
            </span>
            <span style={{ color: T.textOnTealMuted }}>Thinking...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ---- Suggestion chips ---- */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 0 4px',
        flexWrap: 'wrap',
      }}>
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: T.fontSans,
              fontWeight: T.medium,
              color: T.text,
              backgroundColor: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusPill,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => handleChipClick(chip)}
            disabled={loading}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ---- Input bar ---- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 0',
        backgroundColor: T.surface,
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusMd,
          overflow: 'hidden',
        }}>
          <input
            style={{
              flex: 1,
              margin: 0,
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: T.fontSans,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
            }}
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button style={{
            background: 'none',
            border: 'none',
            padding: '8px 10px',
            cursor: 'pointer',
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }} aria-label="Voice input">
            <Mic size={18} />
          </button>
        </div>
        <button
          style={{
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            backgroundColor: T.amber,
            color: T.accentText,
            border: 'none',
            borderRadius: T.radiusMd,
            cursor: 'pointer',
          }}
          onClick={send}
          disabled={loading}
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
