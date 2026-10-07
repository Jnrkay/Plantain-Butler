import React, { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Check } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { uid, fmt } from '../lib/utils';
import { inputSm, labelStyle, btnStyle, btnPrimary, iconBtn } from '../lib/styles';
import { Empty } from './shared';
import { T, monoLabel } from '../lib/theme';

export default function ShoppingPage({ shoppingList, saveSL, genShoppingList, mobile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [est, setEst] = useState('');
  const [cat, setCat] = useState(CATEGORIES[0] || '');

  const checked = shoppingList.filter(i => i.checked).length;
  const total = shoppingList.length;
  const estTotal = shoppingList.filter(i => !i.checked).reduce((s, i) => s + (i.estPrice || 0), 0);

  const toggle = id => {
    saveSL(shoppingList.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const remove = id => {
    saveSL(shoppingList.filter(i => i.id !== id));
  };

  const add = () => {
    if (!name.trim()) return;
    saveSL([
      ...shoppingList,
      { id: uid(), name: name.trim(), estPrice: parseFloat(est) || 0, category: cat, checked: false },
    ]);
    setName('');
    setEst('');
    setShowAdd(false);
  };

  const pageStyle = {
    padding: mobile ? '20px 16px' : '32px 40px',
    maxWidth: 800,
    margin: '0 auto',
  };

  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, flexWrap: 'wrap', gap: 8,
  };

  const progressStyle = {
    fontSize: 13, color: T.textMuted, fontFamily: T.fontSans,
  };

  const chipStyle = {
    fontSize: 11, padding: '2px 8px', borderRadius: T.radiusPill,
    backgroundColor: T.teal + '15', color: T.teal,
    whiteSpace: 'nowrap', fontFamily: T.fontSans,
  };

  const itemStyle = (isChecked) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: T.radiusMd,
    backgroundColor: T.surfaceCard, border: `1px solid ${T.borderLight}`,
    boxShadow: T.shadowSm,
    marginBottom: 8, opacity: isChecked ? 0.55 : 1,
    transition: 'opacity 0.2s',
  });

  const checkboxStyle = (isChecked) => ({
    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
    border: `2px solid ${isChecked ? T.teal : T.border}`,
    backgroundColor: isChecked ? T.teal : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
  });

  const nameStyle = (isChecked) => ({
    flex: 1, fontSize: 14, color: isChecked ? T.textLight : T.text,
    fontFamily: T.fontSans, minWidth: 0,
    textDecoration: isChecked ? 'line-through' : 'none',
  });

  const formRowStyle = {
    display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
    padding: 12, borderRadius: T.radiusMd, marginBottom: 12,
    backgroundColor: T.surfaceCard, border: `1px solid ${T.borderLight}`,
    boxShadow: T.shadowSm,
  };

  const generateBtnStyle = {
    ...btnStyle,
    fontSize: 13,
    padding: '6px 14px',
    backgroundColor: T.amber,
    color: T.accentText,
    border: 'none',
    fontWeight: T.semibold,
    borderRadius: T.radiusMd,
  };

  const addBtnStyle = {
    ...btnPrimary,
    fontSize: 13,
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: T.radiusMd,
  };

  const clearBtnStyle = {
    ...iconBtn,
    padding: 4,
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={{ ...monoLabel, marginBottom: 4 }}>SHOPPING</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: T.semibold, color: T.text, fontFamily: T.fontSans }}>
            Shopping List
          </h2>
          <span style={progressStyle}>
            {checked}/{total} done &middot; Est. {fmt(estTotal)} remaining
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={generateBtnStyle} onClick={genShoppingList}>
            Auto
          </button>
          <button
            style={addBtnStyle}
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {showAdd && (
        <div style={formRowStyle}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={labelStyle}>Item</label>
            <input
              style={inputSm}
              placeholder="Item name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
          </div>
          <div style={{ width: 100 }}>
            <label style={labelStyle}>Est. Price</label>
            <input
              style={inputSm}
              type="number"
              placeholder="0.00"
              value={est}
              onChange={e => setEst(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
          </div>
          <div style={{ width: 130 }}>
            <label style={labelStyle}>Category</label>
            <select
              style={{ ...inputSm, appearance: 'none' }}
              value={cat}
              onChange={e => setCat(e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button style={{ ...btnPrimary, padding: '7px 16px', fontSize: 13, marginBottom: 1, borderRadius: T.radiusMd }} onClick={add}>
            Add
          </button>
        </div>
      )}

      {!shoppingList.length ? (
        <Empty icon={ShoppingCart} message="Your shopping list is empty. Tap Auto to generate one from your purchase history." />
      ) : (
        <div>
          {shoppingList.map(item => (
            <div key={item.id} style={itemStyle(item.checked)}>
              <div style={checkboxStyle(item.checked)} onClick={() => toggle(item.id)}>
                {item.checked && <Check size={14} color={T.surfaceCard} strokeWidth={3} />}
              </div>
              <span style={nameStyle(item.checked)}>{item.name}</span>
              {!mobile && item.category && (
                <span style={chipStyle}>{item.category}</span>
              )}
              <span style={{ fontSize: 13, color: T.textMuted, whiteSpace: 'nowrap', fontFamily: T.fontMono }}>
                {fmt(item.estPrice || 0)}
              </span>
              <button style={clearBtnStyle} onClick={() => remove(item.id)}>
                <Trash2 size={15} color={T.error} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
