import { addDays } from './date'

/** true = goal met, false = missed, null = nothing was due that day (neither extends nor breaks a streak). */
export type DayResult = boolean | null

/**
 * Consecutive met days ending today. An unmet today doesn't break the run,
 * because the day isn't over yet.
 */
export const currentStreak = (isMet: (date: string) => DayResult, today: string, earliest: string) => {
  let count = isMet(today) === true ? 1 : 0
  for (let date = addDays(today, -1); date >= earliest; date = addDays(date, -1)) {
    const result = isMet(date)
    if (result === false) break
    if (result) count += 1
  }
  return count
}

export const bestStreak = (isMet: (date: string) => DayResult, today: string, earliest: string) => {
  let best = 0
  let run = 0
  for (let date = earliest; date <= today; date = addDays(date, 1)) {
    const result = isMet(date)
    if (result === false) run = 0
    else if (result) best = Math.max(best, ++run)
  }
  return best
}
