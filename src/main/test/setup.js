import { vi } from 'vitest'

// Mock process.env
process.env.DIST = ''
process.env.PUBLIC = ''

// Mock electron modules
vi.mock('electron', () => {
  return {
    app: {
      setAppUserModelId: vi.fn(),
      getPath: vi.fn(() => '/mock/path'),
      on: vi.fn(),
      whenReady: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn()
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn()
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn(),
      webContents: {
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    })),
    dialog: {
      showOpenDialog: vi.fn()
    },
    nativeTheme: {
      themeSource: 'light'
    }
  }
})
