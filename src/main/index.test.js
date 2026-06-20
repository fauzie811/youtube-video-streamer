import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import test setup first
import './test/setup'

describe('Main Process', () => {
  // Re-import mocked modules for each test
  let app, ipcMain, BrowserWindow, dialog

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Re-import mocked modules after reset
    const electron = await import('electron')
    app = electron.app
    ipcMain = electron.ipcMain
    BrowserWindow = electron.BrowserWindow
    dialog = electron.dialog
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers IPC handlers on app ready', async () => {
    await import('./index.js')

    expect(ipcMain.handle).toHaveBeenCalledWith('show-about', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('select-video', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('schedule-stream', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('stop-stream', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('update-stream-end', expect.any(Function))
  })

  it('handles file dialog requests', async () => {
    const mockFilePath = '/path/to/video.mp4'
    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [mockFilePath], canceled: false })

    await import('./index.js')

    // Get the registered handler for 'select-video'
    const selectVideoHandler = ipcMain.handle.mock.calls.find(
      (call) => call[0] === 'select-video'
    )?.[1]

    expect(selectVideoHandler).toBeDefined()

    const result = await selectVideoHandler()

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mkv'] }]
      })
    )
    expect(result).toBe(mockFilePath)
  })

  it('handles canceled file dialog', async () => {
    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [], canceled: true })

    await import('./index.js')

    // Get the registered handler for 'select-video'
    const selectVideoHandler = ipcMain.handle.mock.calls.find(
      (call) => call[0] === 'select-video'
    )?.[1]

    const result = await selectVideoHandler()

    expect(result).toBeUndefined()
  })

  it('creates main window on app ready', async () => {
    await import('./index.js')
    await app.whenReady()

    expect(BrowserWindow).toHaveBeenCalled()
    const browserWindow = BrowserWindow.mock.results[0].value
    expect(browserWindow.loadURL).toHaveBeenCalled()
  })

  it('quits app when all windows are closed on non-darwin platform', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await import('./index.js')
    const windowAllClosedHandler = app.on.mock.calls.find(
      (call) => call[0] === 'window-all-closed'
    )[1]
    windowAllClosedHandler()

    expect(app.quit).toHaveBeenCalled()

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('does not quit app when all windows are closed on darwin platform', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })

    await import('./index.js')
    const windowAllClosedHandler = app.on.mock.calls.find(
      (call) => call[0] === 'window-all-closed'
    )[1]
    windowAllClosedHandler()

    expect(app.quit).not.toHaveBeenCalled()

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })
})

describe('redactKey', () => {
  let redactKey

  beforeEach(async () => {
    vi.resetModules()
    ;({ redactKey } = await import('./index.js'))
  })

  const KEY = 'abcd-test-key-1234'

  it('redacts the key from the FFmpeg command (start handler) string', () => {
    const command = `ffmpeg -i video.mp4 -f flv rtmp://a.rtmp.youtube.com/live2/${KEY}`
    const sentMessage = redactKey(`FFMpeg command: ${command}`, KEY)

    expect(sentMessage).not.toContain(KEY)
    expect(sentMessage).toContain('***')
  })

  it('redacts the key from a stderr line that embeds the RTMP URL', () => {
    const stderrLine = `Connection to rtmp://a.rtmp.youtube.com/live2/${KEY} failed`
    const sentMessage = redactKey(`Stderr: ${stderrLine}`, KEY)

    expect(sentMessage).not.toContain(KEY)
    expect(sentMessage).toContain('***')
  })

  it('redacts the key from an error message', () => {
    const errorMessage = `Error: rtmp://a.rtmp.youtube.com/live2/${KEY}: Broken pipe`
    const sentMessage = redactKey(errorMessage, KEY)

    expect(sentMessage).not.toContain(KEY)
    expect(sentMessage).toContain('***')
    // Sentinel tokens used for retry/network detection are preserved
    expect(sentMessage).toContain('Broken pipe')
  })

  it('redacts every occurrence of the key', () => {
    const result = redactKey(`${KEY} and again ${KEY}`, KEY)
    expect(result).toBe('*** and again ***')
  })

  it('returns the text unchanged when streamKey is empty', () => {
    expect(redactKey('no key here', '')).toBe('no key here')
  })

  it('passes through non-string input', () => {
    expect(redactKey(undefined, KEY)).toBeUndefined()
  })
})
