function formatDate(date) {
  const d = date || new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(date) {
  const d = date || new Date()
  const dateStr = formatDate(d)
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${dateStr} ${h}:${min}:${s}`
}

function getToday() {
  return formatDate(new Date())
}

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDate(d)
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

function getDateRange(startDate, endDate) {
  const dates = []
  let current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function isAfterCutoff(cutoffTime) {
  const now = new Date()
  const [h, m] = (cutoffTime || '20:00').split(':')
  const cutoff = new Date()
  cutoff.setHours(parseInt(h), parseInt(m), 0, 0)
  return now > cutoff
}

function getCurrentTime() {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

module.exports = {
  formatDate, formatDateTime,
  getToday, getTomorrow, getYesterday,
  addDays, getDateRange,
  isAfterCutoff, getCurrentTime
}
