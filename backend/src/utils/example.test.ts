import { describe, it, expect } from 'vitest'

describe('Example Test Suite', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should verify string equality', () => {
    const message = 'Hello, Vitest!'
    expect(message).toContain('Vitest')
  })
})
