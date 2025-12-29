import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import FormField from './FormField.svelte'

describe('FormField', () => {
  it('renders with label', () => {
    render(FormField, {
      props: {
        label: 'Test Label',
        id: 'test-field'
      }
    })

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByText('Test Label')).toHaveAttribute('for', 'test-field')
  })

  it('renders with children content', () => {
    render(FormField, {
      props: {
        label: 'Test Label',
        id: 'test-field',
        children: () => '<input type="text" id="test-field" />'
      }
    })

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'test-field')
  })

  it('applies correct styling', () => {
    render(FormField, {
      props: {
        label: 'Test Label',
        id: 'test-field'
      }
    })

    const formGroup = document.querySelector('.form-group')
    expect(formGroup).toHaveStyle({
      display: 'grid',
      'grid-template-columns': '1fr 3fr'
    })
  })
})
