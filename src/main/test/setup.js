import { vi } from 'vitest'

// Mock process.env
process.env.DIST = ''
process.env.PUBLIC = ''
process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'

// Mock electron modules
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
      getPath: vi.fn(() => '/mock/path'),
      getName: vi.fn(() => 'YouTube Video Streamer'),
      getVersion: vi.fn(() => '1.0.0'),
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
    BrowserWindow: mockBrowserWindow,
    dialog: {
      showOpenDialog: vi.fn(),
      showMessageBox: vi.fn().mockResolvedValue({ response: 0 })
    },
    shell: {
      openExternal: vi.fn()
    },
    nativeTheme: {
      themeSource: 'light'
    }
  }
})

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: {
    setAppUserModelId: vi.fn()
  },
  optimizer: {
    watchWindowShortcuts: vi.fn()
  },
  is: {
    dev: true
  }
}))

// Mock fluent-ffmpeg
vi.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = vi.fn(() => ({
    inputOptions: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    run: vi.fn()
  }))
  mockFfmpeg.setFfmpegPath = vi.fn()
  return { default: mockFfmpeg }
})

// Mock ffmpeg-static
vi.mock('ffmpeg-static', () => ({
  default: '/mock/ffmpeg'
}))

// Mock node-schedule
vi.mock('node-schedule', () => ({
  default: {
    scheduleJob: vi.fn(() => ({
      cancel: vi.fn()
    }))
  }
}))
