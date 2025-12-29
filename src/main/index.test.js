import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { app, ipcMain, BrowserWindow, dialog } from 'electron'

// Import test setup
import './test/setup'

describe('Main Process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset modules before each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('registers IPC handlers on app ready', async () => {
    await import('./index.js')

    expect(ipcMain.handle).toHaveBeenCalledWith('dialog:openFile', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('schedule-stream', expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith('stop-stream', expect.any(Function))
  })

  it('handles file dialog requests', async () => {
    const mockFilePath = '/path/to/video.mp4'
    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [mockFilePath], canceled: false })

    const { handleFileOpen } = await import('./index.js')
    const result = await handleFileOpen()

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov'] }]
    })
    expect(result).toBe(mockFilePath)
  })

  it('handles canceled file dialog', async () => {
    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [], canceled: true })

    const { handleFileOpen } = await import('./index.js')
    const result = await handleFileOpen()

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
