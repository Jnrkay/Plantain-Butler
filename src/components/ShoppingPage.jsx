import React, { useState } from 'react';
import { Check, MoreHorizontal, ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { uid } from '../lib/utils';
import { inputSm, labelStyle, btnPrimary } from '../lib/styles';
import { T, monoLabel } from '../lib/theme';

export default function ShoppingPage({ shoppingList, saveSL, genShoppingList, inventory, mobile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [est, setEst] = useState('');
  const [cat, setCat] = useState(CATEGORIES[0] || '');

  const checked = shoppingList.filter(i => i.checked).length;
  const total = shoppingList.length;
  const estTotal = shoppingList.reduce((s, i) => s + (i.estPrice || 0), 0);

  // Build a set of inventory item names that are low/medium stock
  const lowStockNames = new Set(
    (inventory || [])
      .filter(i => i.status === 'low' || i.status === 'medium' || i.status === 'out')
      .map(i => i.name?.toLowerCase())
  );

  const isLowStock = (item) => lowStockNames.has(item.name?.toLowerCase());

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

  const fmtNum = (n) => Number(n || 0).toFixed(2);

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 800, margin: '0 auto' }}>

      {/* 1. Header row: Avatar + menu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: T.teal, color: T.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: T.semibold, fontFamily: T.fontSans,
          letterSpacing: '0.3px',
        }}>
          ED
        </div>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MoreHorizontal size={22} />
        </button>
      </div>

      {/* 2. Title row: "Shopping list" + amber "+" button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{
          margin: 0, fontSize: 28, fontWeight: T.semibold,
          color: T.text, fontFamily: T.fontSans, lineHeight: 1.1,
        }}>
          Shopping list
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: T.amber, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: T.light, color: T.accentText, lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      {/* Add form (shown when "+" is tapped) */}
      {showAdd && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap',
          padding: 12, borderRadius: T.radiusMd, marginBottom: 16,
          backgroundColor: T.surfaceCard, border: `1px solid ${T.borderLight}`,
          boxShadow: T.shadowSm,
        }}>
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
          <button
            style={{ ...btnPrimary, padding: '7px 16px', fontSize: 13, marginBottom: 1, borderRadius: T.radiusMd }}
            onClick={add}
          >
            Add
          </button>
        </div>
      )}

      {/* 3. Auto-Generate CTA card */}
      <div style={{
        backgroundColor: T.surfaceTeal,
        borderRadius: 16,
        padding: '16px 18px',
        marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>AUTO-GENERATE</span>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>FROM STOCK</span>
          </div>
          <div style={{
            fontSize: 16, color: T.textOnTeal, fontFamily: T.fontSans,
            lineHeight: 1.35, fontWeight: T.regular,
          }}>
            Build my list from low stock and my usual run
          </div>
        </div>
        <button
          onClick={genShoppingList}
          style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            backgroundColor: T.amber, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowUpRight size={20} color={T.accentText} strokeWidth={2.5} />
        </button>
      </div>

      {/* 4. Summary line */}
      {total > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 20, padding: '0 2px',
        }}>
          <div>
            <span style={{ ...monoLabel, color: T.textLight }}>
              {total} ITEM{total !== 1 ? 'S' : ''} &middot; {checked} IN CART
            </span>
            <div style={{
              fontSize: 12, color: T.textMuted, fontFamily: T.fontSans, marginTop: 3,
            }}>
              Estimated at Adez Mart
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ ...monoLabel, color: T.textLight }}>EST.</span>
            <span style={{
              fontSize: 13, color: T.textMuted, fontFamily: T.fontSans,
              fontWeight: T.regular, marginRight: 2,
            }}>
              GHS
            </span>
            <span style={{
              fontSize: 36, fontWeight: T.light, color: T.text,
              fontFamily: T.fontSans, lineHeight: 1, letterSpacing: '-1.5px',
            }}>
              {fmtNum(estTotal)}
            </span>
          </div>
        </div>
      )}

      {/* 5. Shopping items */}
      {total === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 16px',
          color: T.textLight, fontFamily: T.fontSans, fontSize: 14,
        }}>
          Your shopping list is empty. Tap the auto-generate card above to build one from your stock levels.
        </div>
      ) : (
        <div>
          {shoppingList.map((item, idx) => {
            const low = isLowStock(item);
            const done = item.checked;
            return (
              <div key={item.id}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 0',
                  }}
                >
                  {/* Checkbox */}
                  <div
                    onClick={() => toggle(item.id)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${done ? T.teal : T.border}`,
                      backgroundColor: done ? T.teal : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {done && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>

                  {/* Name + label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: T.semibold, color: T.text,
                      fontFamily: T.fontSans,
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.45 : 1,
                      lineHeight: 1.2,
                    }}>
                      {item.name}
                    </div>
                    <div style={{
                      ...monoLabel,
                      fontSize: 9.5,
                      marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 4,
                      color: T.textLight,
                    }}>
                      {done ? (
                        <>
                          <span style={{ color: T.textLight }}>ADDED</span>
                          <span>&middot;</span>
                          <span>&times;{item.qty || 1}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: low ? T.warning : T.textLight }}>
                            {low ? 'LOW STOCK' : 'USUAL'}
                          </span>
                          <span>&middot;</span>
                          <span>&times;{item.qty || 1}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <span style={{
                    fontSize: 18, fontWeight: T.medium, color: done ? T.textLight : T.text,
                    fontFamily: T.fontSans, whiteSpace: 'nowrap',
                    opacity: done ? 0.45 : 1,
                  }}>
                    {fmtNum(item.estPrice || 0)}
                  </span>
                </div>
                {/* Separator line between items */}
                {idx < shoppingList.length - 1 && (
                  <div style={{
                    height: 1,
                    backgroundColor: T.borderLight,
                    marginLeft: 36,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
