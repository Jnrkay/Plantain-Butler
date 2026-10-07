// Storage abstraction — currently localStorage, can be swapped for a DB client later

const KEYS = {
  profile: 'pb-profile',
  transactions: 'pb-transactions',
  inventory: 'pb-inventory',
  budgets: 'pb-budgets',
  shoppingList: 'pb-shopping-list',
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Storage save error:', e)
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.error('Storage remove error:', e)
  }
}

export function exportAllData() {
  const data = {}
  for (const [name, key] of Object.entries(KEYS)) {
    const raw = localStorage.getItem(key)
    if (raw) data[name] = JSON.parse(raw)
  }
  data._exportedAt = new Date().toISOString()
  data._version = 1
  return data
}

export function importData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data')
  for (const [name, key] of Object.entries(KEYS)) {
    if (data[name] !== undefined) {
      localStorage.setItem(key, JSON.stringify(data[name]))
    }
  }
}

export { KEYS }
