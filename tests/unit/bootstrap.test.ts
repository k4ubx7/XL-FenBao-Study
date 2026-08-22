import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'

describe('desktop package metadata', () => {
  it('uses the approved product identity', () => {
    expect(pkg.name).toBe('fenbao-study')
    expect(pkg.productName).toBe('粉包学习记')
    expect(pkg.main).toBe('./out/main/index.js')
  })
})
