import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function TestComponent() {
  return <div>Hello, Test!</div>
}

describe('Example React Component Test', () => {
  it('should render test component', () => {
    render(<TestComponent />)
    expect(screen.getByText('Hello, Test!')).toBeDefined()
  })
})
