import { describe, expect, it } from 'vitest'
import { activityMet, bmi, bmiBand, bmr, bodyMetrics, estimateActivityCalories, healthyWeightRange, movingAverage, suggestedGoals, tdee, waterGlasses } from '../health'

describe('bmi', () => {
  it('divides weight by height in metres squared', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2)
  })

  it.each([
    [18.4, 'under'], [18.5, 'healthy'], [24.9, 'healthy'], [25, 'over'], [29.9, 'over'], [30, 'obese'],
  ])('puts %s in the %s band', (value, band) => {
    expect(bmiBand(value).band).toBe(band)
  })

  it('gives the weight range for a healthy BMI', () => {
    const range = healthyWeightRange(175)
    expect(range.min).toBeCloseTo(56.66, 1)
    expect(range.max).toBeCloseTo(76.26, 1)
  })
})

describe('energy needs', () => {
  it('matches the Mifflin-St Jeor equation', () => {
    // 10×70 + 6.25×175 − 5×30 + 5
    expect(bmr(70, 175, 30, 'male')).toBeCloseTo(1648.75)
    // 10×60 + 6.25×165 − 5×30 − 161
    expect(bmr(60, 165, 30, 'female')).toBeCloseTo(1320.25)
  })

  it('scales resting energy by activity level', () => {
    expect(tdee(1600, 'sedentary')).toBeCloseTo(1920)
    expect(tdee(1600, 'moderate')).toBeCloseTo(2480)
  })

  it('returns nothing until the profile and a weight are complete', () => {
    expect(bodyMetrics({ activityLevel: 'light' }, 70)).toBeNull()
    expect(bodyMetrics({ activityLevel: 'light', heightCm: 175, birthYear: 1996, sex: 'male' }, undefined)).toBeNull()
  })

  it('derives rounded goal suggestions from the profile', () => {
    const metrics = bodyMetrics({ activityLevel: 'moderate', heightCm: 175, birthYear: 1996, sex: 'male' }, 70, new Date(2026, 5, 1))!
    expect(metrics.age).toBe(30)
    expect(suggestedGoals(metrics)).toEqual({ calories: 2550, protein: 110, water: 10 })
  })

  it('recommends 35 ml of water per kg in 250 ml glasses', () => {
    expect(waterGlasses(70)).toBe(10)
    expect(waterGlasses(50)).toBe(7)
  })
})

describe('activity estimates', () => {
  it('uses the pace to pick a MET value for walks and runs', () => {
    expect(activityMet('Walk', 60, 3)).toBe(2.0)
    expect(activityMet('Walk', 60, 3.5)).toBe(2.8)
    expect(activityMet('Walk', 60, 6)).toBe(5.0)
    expect(activityMet('Run', 30, 5)).toBe(9.8)
    expect(activityMet('Run', 60, 16)).toBe(14.5)
  })

  it('falls back to a typical MET value without a distance', () => {
    expect(activityMet('Walk', 30)).toBe(3.5)
    expect(activityMet('Gym', 45)).toBe(3.5)
  })

  it('multiplies MET by weight and hours', () => {
    expect(estimateActivityCalories('Run', 30, 70, 5)).toBe(343)
    expect(estimateActivityCalories('Walk', 0, 70)).toBe(0)
  })
})

describe('movingAverage', () => {
  it('averages every weigh-in in the trailing window, ignoring gaps', () => {
    const trend = movingAverage([
      { date: '2026-09-10', kg: 72 },
      { date: '2026-09-01', kg: 70 },
      { date: '2026-09-04', kg: 71 },
      { date: '2026-09-07', kg: 73 },
    ])
    expect(trend.map((point) => point.date)).toEqual(['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-10'])
    expect(trend[0].kg).toBe(70)
    expect(trend[2].kg).toBeCloseTo(71.333, 2) // Sep 1–7
    expect(trend[3].kg).toBeCloseTo(72, 2) // Sep 4–10
  })
})
