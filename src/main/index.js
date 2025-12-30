import { app, shell, BrowserWindow, ipcMain, dialog, nativeTheme } from 'electron'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import schedule from 'node-schedule'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { stat } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'))

nativeTheme.themeSource = 'light'

const VIDEO_BITRATE = '2000k'

class StreamManager {
  constructor() {
    this.streams = new Map()
    this.mainWindow = null
  }

  setMainWindow(window) {
    this.mainWindow = window
  }

  sendToMainWindow(channel, ...args) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args)
    }
  }

  hasActiveStreams() {
    return Array.from(this.streams.values()).some(
      (streamData) => streamData.stream || streamData.scheduledJob
    )
  }

  cleanupStream(streamId) {
    const streamData = this.streams.get(streamId)
    if (!streamData) return

    if (streamData.stopJob) {
      streamData.stopJob.cancel()
    }

    if (streamData.stream) {
      streamData.stream.kill()
    }

    if (streamData.scheduledJob) {
      streamData.scheduledJob.cancel()
    }

    this.streams.delete(streamId)
  }

  cleanupAllStreams() {
    for (const [streamId] of this.streams) {
      this.cleanupStream(streamId)
    }
    this.streams.clear()
  }

  createFFmpegStream(videoPath, streamKey) {
    const streamUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
    return ffmpeg(videoPath)
      .inputOptions(['-stream_loop', '-1', '-re'])
      .outputOptions([
        '-b:v',
        VIDEO_BITRATE,
        '-preset',
        'veryfast',
        '-codec',
        'copy',
        '-f',
        'flv',
        '-flvflags',
        'no_duration_filesize',
        '-loglevel',
        'error'
      ])
      .output(streamUrl)
  }

  setupStreamEndJob(streamId, endTime) {
    const endDateTime = new Date(endTime)
    if (endDateTime > new Date()) {
      // Cancel existing stop job if it exists
      const streamData = this.streams.get(streamId)
      if (streamData?.stopJob) {
        streamData.stopJob.cancel()
      }

      const stopJob = schedule.scheduleJob(endDateTime, () => {
        this.cleanupStream(streamId)
      })

      if (streamData) {
        streamData.stopJob = stopJob
      }
    }
  }

  async startStreaming(streamId, videoPath, streamKey, duration, endTime) {
    try {
      await stat(videoPath)
    } catch (error) {
      throw new Error('Video file not found or not accessible')
    }

    const MAX_RETRIES = 5
    const RETRY_DELAY = 3000 // 3 seconds
    let retryCount = 0
    const initialStartTime = Date.now()

    const startStreamWithRetry = () => {
      return new Promise((resolve) => {
        const stream = this.createFFmpegStream(videoPath, streamKey)
          .on('start', (command) => {
            this.sendToMainWindow('streaming-started', streamId)
            this.sendToMainWindow('stream-log', { streamId, message: `FFMpeg command: ${command}` })
          })
          .on('end', () => {
            this.cleanupStream(streamId)
            this.sendToMainWindow('streaming-stopped', streamId)
            resolve()
          })
          .on('stderr', (stderrLine) => {
            this.sendToMainWindow('stream-log', { streamId, message: `Stderr: ${stderrLine}` })
          })
          .on('error', (err) => {
            // Handle the error for this specific stream
            const streamData = this.streams.get(streamId)
            const errorMessage = err.message || ''

            if (errorMessage.includes('SIGKILL')) {
              // Intentional stop - full cleanup
              this.cleanupStream(streamId)
              this.sendToMainWindow('streaming-stopped', streamId)
              resolve()
              return
            }

            // Check for recoverable network errors (Windows: 10053, 10054; Unix equivalents)
            const isNetworkError =
              errorMessage.includes('10053') ||
              errorMessage.includes('10054') ||
              errorMessage.includes('ECONNRESET') ||
              errorMessage.includes('ECONNABORTED') ||
              errorMessage.includes('Connection refused') ||
              errorMessage.includes('Broken pipe')

            // Only kill current stream process, preserve stream data for retry
            if (streamData?.stopJob) {
              streamData.stopJob.cancel()
              streamData.stopJob = null
            }
            if (streamData?.stream) {
              streamData.stream = null
            }

            if (retryCount < MAX_RETRIES) {
              retryCount++
              // Use exponential backoff for network errors
              const delay = isNetworkError ? RETRY_DELAY * Math.pow(2, retryCount - 1) : RETRY_DELAY
              this.sendToMainWindow('stream-log', {
                streamId,
                message: `Stream error (${isNetworkError ? 'network' : 'unknown'}), retrying in ${delay / 1000}s (${retryCount}/${MAX_RETRIES}): ${errorMessage}`
              })

              // Retry after delay
              setTimeout(() => {
                startStreamWithRetry().then(resolve)
              }, delay)
            } else {
              // Max retries reached - full cleanup
              this.cleanupStream(streamId)
              this.sendToMainWindow('streaming-error', {
                streamId,
                message: `Stream failed after ${MAX_RETRIES} retries: ${errorMessage}`
              })
              resolve()
            }
          })

        stream.run()

        this.streams.set(streamId, {
          stream,
          stopJob: null,
          initialStartTime
        })

        if (duration) {
          // Calculate remaining duration based on initial start time
          const elapsedTime = (Date.now() - initialStartTime) / 1000
          const remainingDuration = Math.max(0, duration - elapsedTime)
          const endDate = new Date(Date.now() + remainingDuration * 1000)
          this.setupStreamEndJob(streamId, endDate)
        } else if (endTime) {
          this.setupStreamEndJob(streamId, endTime)
        }
      })
    }

    return startStreamWithRetry()
  }

  async handleStreamScheduling(
    event,
    { streamId, videoPath, streamKey, startTime, duration, endTime }
  ) {
    const startStream = async () => {
      try {
        await this.startStreaming(streamId, videoPath, streamKey, duration, endTime)
      } catch (error) {
        // Handle any errors that occur during stream setup
        this.cleanupStream(streamId)
        event.reply('streaming-error', {
          streamId,
          message: error.message || 'Failed to start streaming'
        })
      }
    }

    try {
      const scheduledTime = new Date(startTime)

      if (scheduledTime < new Date()) {
        await startStream()
      } else {
        const job = schedule.scheduleJob(scheduledTime, startStream)
        this.streams.set(streamId, { scheduledJob: job })
        event.reply('stream-scheduled', { streamId, scheduledTime })
      }
    } catch (error) {
      this.cleanupStream(streamId)
      event.reply('scheduling-error', {
        streamId,
        message: error.message || 'Failed to schedule stream'
      })
    }
  }
}

const streamManager = new StreamManager()

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 640,
    height: 400,
    minWidth: 640,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  streamManager.setMainWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', async (event) => {
    if (streamManager.hasActiveStreams()) {
      event.preventDefault()
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Close',
        message:
          'There are active or scheduled streams. Are you sure you want to close the application?'
      })

      if (response === 0) {
        mainWindow.destroy()
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.youtubevideostreamer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  streamManager.cleanupAllStreams()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('show-about', () => {
  const appInfo = {
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }

  dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
    type: 'info',
    title: 'About',
    message: `${appInfo.name}`,
    detail: `Version: ${appInfo.version}\nElectron: ${appInfo.electron}\nChrome: ${appInfo.chrome}\nNode: ${appInfo.node}`,
    buttons: ['OK'],
    icon: icon
  })
})

ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mkv'] }]
  })

  if (!result.canceled) {
    return result.filePaths[0]
  }
})

ipcMain.on('schedule-stream', (event, streamOptions) => {
  streamManager.handleStreamScheduling(event, streamOptions)
})

ipcMain.on('stop-stream', (event, streamId) => {
  streamManager.cleanupStream(streamId)
  streamManager.sendToMainWindow('streaming-stopped', streamId)
})

ipcMain.on('update-stream-end', (event, { streamId, endTime }) => {
  const streamData = streamManager.streams.get(streamId)
  if (streamData?.stream) {
    streamManager.setupStreamEndJob(streamId, endTime)
    streamManager.sendToMainWindow('stream-log', {
      streamId,
      message: `Stream end time updated to ${new Date(endTime).toLocaleString()}`
    })
  }
})
