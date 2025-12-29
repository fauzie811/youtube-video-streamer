import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/svelte'
import { afterEach } from 'vitest'

// runs a cleanup after each test case
afterEach(() => {
  cleanup()
})
