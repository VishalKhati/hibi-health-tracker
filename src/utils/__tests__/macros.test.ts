import { describe, expect, it } from 'vitest'
import { calorieSplit, hasBreakdown, macroLine, pickMacros } from '../macros'

describe('macros', () => {
  it('keeps only known, valid values, rounded', () => {
    expect(pickMacros({ carbs: 26.44, fat: undefined, fiber: -1 })).toEqual({ carbs: 26.4 })
    expect(hasBreakdown({})).toBe(false)
    expect(hasBreakdown({ fat: 0 })).toBe(true)
  })

  it('describes an entry, leaving out what isn’t known', () => {
    expect(macroLine({ calories: 86, protein: 2.87, carbs: 16.1, fat: 0.5 })).toBe('2.9g protein · 16.1g carbs · 0.5g fat')
    expect(macroLine({ calories: 105, protein: 1 })).toBe('1g protein')
  })

  it('splits calories 4/4/9 between protein, carbs and fat', () => {
    const split = calorieSplit({ calories: 0, protein: 10, carbs: 20, fat: 10 })!
    expect(split.protein).toBeCloseTo(40 / 210)
    expect(split.carbs).toBeCloseTo(80 / 210)
    expect(split.fat).toBeCloseTo(90 / 210)
    expect(calorieSplit({ calories: 0, protein: 0 })).toBeNull()
  })
})
