import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import StreamForm from './StreamForm.svelte'
import { get } from 'svelte/store'
import streams from '../stores/streams'

describe('StreamForm', () => {
  const mockStream = {
    id: '1',
    videoTitle: 'Test Video',
    videoFile: '/path/to/video.mp4',
    streamKey: 'test-stream-key',
    startTime: '2024-03-14T12:00',
    isEndByDuration: true,
    duration: '01:00:00',
    status: 'ready',
    logs: ['Test log']
  }

  const mockProps = {
    stream: mockStream,
    selectVideo: vi.fn(),
    scheduleStream: vi.fn(),
    stopStream: vi.fn()
  }

  it('renders all form fields', () => {
    render(StreamForm, { props: mockProps })

    expect(screen.getByLabelText('Channel / Title:')).toBeInTheDocument()
    expect(screen.getByLabelText('Video File:')).toBeInTheDocument()
    expect(screen.getByLabelText('Stream Key:')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Time:')).toBeInTheDocument()
  })

  it('displays stream data correctly', () => {
    render(StreamForm, { props: mockProps })

    expect(screen.getByLabelText('Channel / Title:')).toHaveValue('Test Video')
    expect(screen.getByLabelText('Video File:')).toHaveValue('/path/to/video.mp4')
    expect(screen.getByLabelText('Stream Key:')).toHaveValue('test-stream-key')
    expect(screen.getByLabelText('Start Time:')).toHaveValue('2024-03-14T12:00')
  })

  it('handles form input changes', async () => {
    render(StreamForm, { props: mockProps })

    const titleInput = screen.getByLabelText('Channel / Title:')
    await fireEvent.input(titleInput, { target: { value: 'New Title' } })

    const updatedStreams = get(streams)
    const updatedStream = updatedStreams.find((s) => s.id === '1')
    expect(updatedStream?.videoTitle).toBe('New Title')
  })

  it('disables inputs when status is not ready', () => {
    const notReadyStream = { ...mockStream, status: 'scheduled' }
    render(StreamForm, { props: { ...mockProps, stream: notReadyStream } })

    expect(screen.getByLabelText('Channel / Title:')).toBeDisabled()
    expect(screen.getByLabelText('Video File:')).toBeDisabled()
    expect(screen.getByLabelText('Stream Key:')).toBeDisabled()
  })

  it('calls scheduleStream when start button is clicked', async () => {
    render(StreamForm, { props: mockProps })

    const startButton = screen.getByText('Start / Schedule')
    await fireEvent.click(startButton)

    expect(mockProps.scheduleStream).toHaveBeenCalledWith('1')
  })

  it('displays logs in textarea', () => {
    render(StreamForm, { props: mockProps })

    const textarea = screen.getByRole('textbox', { name: 'Log Output:' })
    expect(textarea).toHaveValue('Test log')
  })
})
