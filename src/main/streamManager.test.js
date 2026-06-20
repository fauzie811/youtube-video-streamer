import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture the handlers registered on the fluent-ffmpeg stream object so the
// tests can fire 'start'/'error'/etc. on demand. The shared mock in
// ./test/setup.js discards callbacks, so this file installs its own.
const captured = { handlers: {}, constructed: 0, killed: 0, ran: 0 }

vi.mock('fluent-ffmpeg', () => {
  const mk = vi.fn(() => {
    captured.constructed++
    const obj = {
      inputOptions: vi.fn().mockReturnThis(),
      outputOptions: vi.fn().mockReturnThis(),
      output: vi.fn().mockReturnThis(),
      on: vi.fn(function (ev, cb) {
        captured.handlers[ev] = cb
        return this
      }),
      run: vi.fn(() => {
        captured.ran++
      }),
      kill: vi.fn(() => {
        captured.killed++
      })
    }
    return obj
  })
  mk.setFfmpegPath = vi.fn()
  return { default: mk }
})

vi.mock('ffmpeg-static', () => ({ default: '/mock/ffmpeg' }))

vi.mock('node-schedule', () => ({
  default: { scheduleJob: vi.fn(() => ({ cancel: vi.fn() })) }
}))

vi.mock('fs/promises', () => {
  const stat = vi.fn().mockResolvedValue({})
  return { stat, default: { stat } }
})

vi.mock('electron', () => {
  const mockBrowserWindow = vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
      setWindowOpenHandler: vi.fn()
    }
  }))
  mockBrowserWindow.getAllWindows = vi.fn(() => [])
  mockBrowserWindow.getFocusedWindow = vi.fn(() => ({}))
  return {
    app: {
      setAppUserModelId: vi.fn(),
      getName: vi.fn(() => 'YouTube Video Streamer'),
      getVersion: vi.fn(() => '1.0.0'),
      on: vi.fn(),
      whenReady: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn()
    },
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    BrowserWindow: mockBrowserWindow,
    dialog: { showOpenDialog: vi.fn(), showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) },
    shell: { openExternal: vi.fn() },
    nativeTheme: { themeSource: 'light' }
  }
})

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: true }
}))

import { StreamManager } from './index.js'

function makeManager() {
  const sm = new StreamManager()
  sm.setMainWindow({ isDestroyed: () => false, webContents: { send: vi.fn() } })
  return sm
}

describe('StreamManager retry lifecycle', () => {
  beforeEach(() => {
    captured.handlers = {}
    captured.constructed = 0
    captured.killed = 0
    captured.ran = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test A: stop during backoff does not resurrect the stream', async () => {
    const sm = makeManager()

    // Start streaming WITHOUT awaiting; the stream stays "running".
    sm.startStreaming('s1', '/any/video.mp4', 'KEY', null, null)
    // Allow the awaited stat() precondition to resolve and the stream to be set up.
    await vi.advanceTimersByTimeAsync(0)

    expect(captured.constructed).toBe(1)
    expect(sm.streams.has('s1')).toBe(true)

    // A recoverable network error schedules a retry timer.
    captured.handlers.error({ message: 'ECONNRESET' })

    // User stops the stream during the backoff window.
    sm.cleanupStream('s1')

    // Advance well past any backoff delay.
    await vi.advanceTimersByTimeAsync(60000)

    // No second FFmpeg process created, and the stream is gone for good.
    expect(captured.constructed).toBe(1)
    expect(sm.streams.has('s1')).toBe(false)
  })

  it('Test B: retry budget resets on a successful reconnect', async () => {
    const sm = makeManager()

    sm.startStreaming('s1', '/any/video.mp4', 'KEY', null, null)
    await vi.advanceTimersByTimeAsync(0)

    // 3 network errors, each followed by a retry that reconstructs the stream.
    for (let i = 0; i < 3; i++) {
      captured.handlers.error({ message: 'ECONNRESET' })
      await vi.advanceTimersByTimeAsync(60000)
    }
    // 1 initial + 3 reconstructions
    expect(captured.constructed).toBe(4)
    expect(sm.streams.has('s1')).toBe(true)

    // Successful reconnect resets the retry budget.
    captured.handlers.start('ffmpeg ...')

    // 3 more network errors should still be within budget (reset to 0),
    // so the stream keeps retrying and is never permanently killed.
    for (let i = 0; i < 3; i++) {
      captured.handlers.error({ message: 'ECONNRESET' })
      await vi.advanceTimersByTimeAsync(60000)
    }

    // Still alive and retrying: 4 + 3 more reconstructions = 7, stream present.
    expect(captured.constructed).toBe(7)
    expect(sm.streams.has('s1')).toBe(true)
  })
})
