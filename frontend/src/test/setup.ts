import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/dom'

// Runs a cleanup after each test case
afterEach(() => {
  cleanup()
})
