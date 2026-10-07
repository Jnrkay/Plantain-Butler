export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const fmt = (n) => `GHS ${Number(n || 0).toFixed(2)}`

export const today = () => new Date().toISOString().split('T')[0]

export const monthKey = (d) => {
  if (!d) return today().slice(0, 7)
  if (d instanceof Date) return d.toISOString().slice(0, 7)
  return d.slice(0, 7)
}

export const monthLabel = (mk) => {
  const key = mk instanceof Date ? monthKey(mk) : mk
  const [y, m] = key.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[+m - 1]} '${y.slice(2)}`
}
