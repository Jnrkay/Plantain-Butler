import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { STOCK_STATUS } from '../lib/constants';
import { fmt, today, monthKey } from '../lib/utils';
import { T, monoLabel } from '../lib/theme';

const INITIAL_MSG = {
  role: 'assistant',
  content: "Hi! I'm your Plantain Butler. Ask me anything about your spending, inventory, or budget.\n\nTry:\n• How much did I spend this month?\n• What's running low?\n• Help me optimize my budget.",
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

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: mobile ? 'calc(100vh - 100px)' : 'calc(100vh - 48px)',
    backgroundColor: T.surface,
    fontFamily: T.fontSans,
  };

  const headerStyle = {
    padding: '16px 0 8px',
    ...monoLabel,
  };

  const chatAreaStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const bubbleBase = {
    maxWidth: '80%',
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: T.fontSans,
  };

  const userBubble = {
    ...bubbleBase,
    alignSelf: 'flex-end',
    backgroundColor: T.teal,
    color: T.warm,
    borderRadius: `${T.radiusMd}px ${T.radiusMd}px 4px ${T.radiusMd}px`,
  };

  const assistantBubble = {
    ...bubbleBase,
    alignSelf: 'flex-start',
    backgroundColor: T.surfaceCard,
    color: T.text,
    border: `1px solid ${T.borderLight}`,
    borderRadius: `${T.radiusMd}px ${T.radiusMd}px ${T.radiusMd}px 4px`,
  };

  const inputBarStyle = {
    display: 'flex',
    gap: 8,
    padding: '12px 0',
    backgroundColor: T.surfaceCard,
    borderTop: `1px solid ${T.borderLight}`,
    margin: '0 -16px',
    paddingLeft: 16,
    paddingRight: 16,
  };

  const chatInputStyle = {
    flex: 1,
    margin: 0,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: T.fontSans,
    backgroundColor: '#ffffff',
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    outline: 'none',
    color: T.text,
  };

  const sendBtnStyle = {
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: T.amber,
    color: T.accentText,
    border: 'none',
    borderRadius: T.radiusMd,
    cursor: 'pointer',
    fontFamily: T.fontSans,
    fontWeight: T.semibold,
  };

  const emptyHint = {
    color: T.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: '24px 16px',
    fontFamily: T.fontSans,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>BUTLER</div>
      <div style={chatAreaStyle}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? userBubble : assistantBubble}>
            {m.error ? (
              <span style={{ color: T.error }}>{m.content}</span>
            ) : (
              m.content
            )}
          </div>
        ))}
        {loading && (
          <div style={assistantBubble}>
            <span style={{ color: T.textLight }}>Thinking...</span>
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
