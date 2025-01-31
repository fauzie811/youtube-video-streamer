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
    if (!streamData) return false

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
    return true
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
      .inputOptions(['-stream_loop', '-1', '-re', '-hwaccel', 'auto'])
      .outputOptions([
        '-b:v',
        VIDEO_BITRATE,
        '-maxrate',
        VIDEO_BITRATE,
        '-bufsize',
        '4000k',
        '-preset',
        'veryfast',
        '-tune',
        'zerolatency',
        '-g',
        '60',
        '-keyint_min',
        '60',
        '-sc_threshold',
        '0',
        '-threads',
        '0',
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
      const stopJob = schedule.scheduleJob(endDateTime, () => {
        if (this.cleanupStream(streamId)) {
          this.sendToMainWindow('streaming-stopped', streamId)
        }
      })
      const streamData = this.streams.get(streamId)
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

    const startStreamWithRetry = () => {
      return new Promise((resolve) => {
        const stream = this.createFFmpegStream(videoPath, streamKey)
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
            this.cleanupStream(streamId)

            if (err.message?.includes('SIGKILL')) {
              this.sendToMainWindow('streaming-stopped', streamId)
              resolve()
            } else {
              if (retryCount < MAX_RETRIES) {
                retryCount++
                this.sendToMainWindow('streaming-error', {
                  streamId,
                  message: `Stream error, retrying (${retryCount}/${MAX_RETRIES}): ${err.message}`
                })

                // Retry after delay
                setTimeout(() => {
                  startStreamWithRetry().then(resolve)
                }, RETRY_DELAY)
              } else {
                this.sendToMainWindow('streaming-error', {
                  streamId,
                  message: `Stream failed after ${MAX_RETRIES} retries: ${err.message}`
                })
                resolve()
              }
            }
          })

        stream.run()

        this.streams.set(streamId, {
          stream,
          stopJob: null
        })

        if (duration) {
          const endDate = new Date(Date.now() + duration * 1000)
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
        event.reply('streaming-started', streamId)
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
  if (streamManager.cleanupStream(streamId)) {
    streamManager.sendToMainWindow('streaming-stopped', streamId)
  }
})
