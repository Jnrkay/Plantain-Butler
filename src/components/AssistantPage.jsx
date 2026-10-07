import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { STOCK_STATUS } from '../lib/constants';
import { fmt, today, monthKey } from '../lib/utils';
import { inputStyle, btnPrimary } from '../lib/styles';

const COLORS = {
  bg: '#0f1117', surface: '#161822', surface2: '#1a1d2e',
  border: '#1e2030', text: '#e2e8f0', muted: '#94a3b8',
  dim: '#64748b', accent: '#06b6d4',
};

const INITIAL_MSG = {
  role: 'assistant',
  content: "Hi! I'm your Plantain Butler \u{1F34C} Ask me anything about your spending, inventory, or budget.\n\nTry:\n• How much did I spend this month?\n• What's running low?\n• Help me optimize my budget.",
};

export default function AssistantPage({ transactions, inventory, profile, mobile }) {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContext = () => {
    const mk = monthKey(new Date());
    const monthTx = transactions.filter(t => monthKey(new Date(t.date)) === mk);
    const monthTotal = monthTx.reduce((s, t) => s + t.price * t.qty, 0);

    const invSlice = inventory.slice(0, 30).map(i =>
      `${i.name}: ${i.qty} ${i.unit || ''} (${STOCK_STATUS[i.status] || i.status})`
    ).join('\n');

    const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'out')
      .map(i => `${i.name} (${STOCK_STATUS[i.status] || i.status})`).join(', ');

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

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      // Build API messages: skip the initial assistant greeting, use last 20
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    display: 'flex', flexDirection: 'column',
    height: mobile ? 'calc(100vh - 68px)' : 'calc(100vh - 48px)',
  };

  const chatAreaStyle = {
    flex: 1, overflowY: 'auto', padding: '16px 0',
    display: 'flex', flexDirection: 'column', gap: 12,
  };

  const bubbleBase = {
    maxWidth: '80%', padding: '10px 14px', borderRadius: 14,
    fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  };

  const userBubble = {
    ...bubbleBase,
    alignSelf: 'flex-end',
    backgroundColor: COLORS.accent,
    color: '#0f1117',
    borderBottomRightRadius: 4,
  };

  const assistantBubble = {
    ...bubbleBase,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    borderBottomLeftRadius: 4,
  };

  const inputBarStyle = {
    display: 'flex', gap: 8, padding: '12px 0',
    borderTop: `1px solid ${COLORS.border}`,
  };

  const chatInputStyle = {
    ...inputStyle,
    flex: 1, margin: 0,
  };

  const sendBtnStyle = {
    ...btnPrimary,
    padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      <div style={chatAreaStyle}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? userBubble : assistantBubble}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={assistantBubble}>
            <span style={{ color: COLORS.muted }}>Thinking...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={inputBarStyle}>
        <input
          style={chatInputStyle}
          placeholder="Ask about your spending, inventory..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button style={sendBtnStyle} onClick={send} disabled={loading}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
