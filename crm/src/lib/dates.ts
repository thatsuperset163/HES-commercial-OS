export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isToday(iso: string | null | undefined) {
  if (!iso) return false
  return isSameDay(new Date(iso), new Date())
}

export function isOverdue(iso: string | null | undefined) {
  if (!iso) return false
  return new Date(iso) < startOfDay()
}

export function isThisMonth(iso: string | null | undefined) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export function daysFromNow(n: number, hour = 9) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export function daysAgo(n: number, hour = 10) {
  return daysFromNow(-n, hour)
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatMoney(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function toDateInput(iso: string | null | undefined) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function fromDateInput(value: string, hour = 9) {
  if (!value) return null
  return new Date(`${value}T${String(hour).padStart(2, '0')}:00:00`).toISOString()
}
