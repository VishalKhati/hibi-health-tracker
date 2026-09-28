export const dateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const longDate = (key: string) =>
  new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(`${key}T12:00:00`),
  )

// Formatted on its own because part order in combined formats varies by ICU build ("Sun 27" vs "27 Sun").
export const weekdayShort = (key: string) =>
  new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(`${key}T12:00:00`))

export const pastDays = (count: number) => {
  const days: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date()
    day.setDate(day.getDate() - offset)
    days.push(dateKey(day))
  }
  return days
}

/** Calendar arithmetic on YYYY-MM-DD keys; anchored at noon so DST shifts never skip a day. */
export const addDays = (key: string, amount: number) => {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

export const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1, 12))

/** Sunday-first weeks covering the month; days outside it are null. */
export const monthGrid = (year: number, month: number) => {
  const first = new Date(year, month, 1, 12)
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate()
  const cells: (string | null)[] = Array(first.getDay()).fill(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(dateKey(new Date(year, month, day, 12)))
  while (cells.length % 7) cells.push(null)
  return cells
}
