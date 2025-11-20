import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
  it('should merge class names', () => {
    const result = cn('px-2 py-1', 'bg-blue-500')
    expect(result).toContain('px-2')
    expect(result).toContain('py-1')
    expect(result).toContain('bg-blue-500')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toContain('base-class')
    expect(result).toContain('active-class')
  })

  it('should handle false conditional classes', () => {
    const isActive = false
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toContain('base-class')
    expect(result).not.toContain('active-class')
  })

  it('should merge conflicting Tailwind classes correctly', () => {
    // tailwind-merge should keep the last conflicting class
    const result = cn('px-2', 'px-4')
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
  })

  it('should handle array of classes', () => {
    const result = cn(['class1', 'class2', 'class3'])
    expect(result).toContain('class1')
    expect(result).toContain('class2')
    expect(result).toContain('class3')
  })

  it('should handle undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'other-class')
    expect(result).toContain('base-class')
    expect(result).toContain('other-class')
  })

  it('should handle object-style class definitions', () => {
    const result = cn({
      'class-1': true,
      'class-2': false,
      'class-3': true,
    })
    expect(result).toContain('class-1')
    expect(result).not.toContain('class-2')
    expect(result).toContain('class-3')
  })

  it('should handle empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle mixed input types', () => {
    const result = cn(
      'base',
      ['array-1', 'array-2'],
      { 'obj-1': true, 'obj-2': false },
      true && 'conditional',
      undefined,
      null
    )
    expect(result).toContain('base')
    expect(result).toContain('array-1')
    expect(result).toContain('array-2')
    expect(result).toContain('obj-1')
    expect(result).not.toContain('obj-2')
    expect(result).toContain('conditional')
  })
})
