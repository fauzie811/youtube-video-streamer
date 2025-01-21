import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { setupTitlebar, attachTitlebarToWindow } from 'custom-electron-titlebar/main'
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

let mainWindow

const VIDEO_BITRATE = '2000k'

// Modify the stream tracking to handle multiple streams
const streams = new Map()

setupTitlebar()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 360,
    minWidth: 640,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  attachTitlebarToWindow(mainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.youtubevideostreamer')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Stop all streams
  for (const [_, streamData] of streams) {
    if (streamData.durationTimeout) {
      clearTimeout(streamData.durationTimeout)
    }
    if (streamData.stream) {
      streamData.stream.kill()
    }
    if (streamData.scheduledJob) {
      streamData.scheduledJob.cancel()
    }
  }
  streams.clear()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function sendToMainWindow(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}
// Handle file selection
ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mkv'] }]
  })

  if (!result.canceled) {
    return result.filePaths[0]
  }
})

// Start streaming
function startStreaming(streamId, videoPath, streamKey, duration, endTime) {
  const streamUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`

  return new Promise((resolve, reject) => {
    try {
      stat(videoPath).catch(() => {
        reject(new Error('Video file not found or not accessible'))
      })
    } catch (error) {
      return
    }

    const stream = ffmpeg(videoPath)
      .inputOptions(['-stream_loop', '-1', '-re'])
      .outputOptions(['-b:v', VIDEO_BITRATE, '-preset', 'veryfast', '-codec', 'copy', '-f', 'flv'])
      .output(streamUrl)
      .on('end', () => {
        streams.delete(streamId)
        resolve()
      })
      .on('error', (err) => {
        if (err.message?.includes('SIGKILL')) {
          streams.delete(streamId)
          resolve()
        } else {
          reject(err)
        }
      })

    stream.run()

    // Store stream information
    streams.set(streamId, {
      stream,
      durationTimeout: null
    })

    // Handle duration/end time
    if (duration) {
      const timeout = setTimeout(() => {
        const streamData = streams.get(streamId)
        if (streamData) {
          streamData.stream.kill()
          streams.delete(streamId)
          sendToMainWindow('streaming-stopped', streamId)
        }
      }, duration * 1000)

      streams.get(streamId).durationTimeout = timeout
    } else if (endTime) {
      const endDateTime = new Date(endTime)
      const timeUntilEnd = endDateTime.getTime() - Date.now()
      if (timeUntilEnd > 0) {
        const timeout = setTimeout(() => {
          const streamData = streams.get(streamId)
          if (streamData) {
            streamData.stream.kill()
            streams.delete(streamId)
            sendToMainWindow('streaming-stopped', streamId)
          }
        }, timeUntilEnd)

        streams.get(streamId).durationTimeout = timeout
      }
    }
  })
}

// Handle stream scheduling
ipcMain.on(
  'schedule-stream',
  async (event, { streamId, videoPath, streamKey, startTime, duration, endTime }) => {
    try {
      const scheduledTime = new Date(startTime)

      if (scheduledTime < new Date()) {
        try {
          event.reply('streaming-started', streamId)
          await startStreaming(streamId, videoPath, streamKey, duration, endTime)
        } catch (error) {
          event.reply('streaming-error', { streamId, message: error.message })
        }
      } else {
        const job = schedule.scheduleJob(scheduledTime, async () => {
          try {
            event.reply('streaming-started', streamId)
            await startStreaming(streamId, videoPath, streamKey, duration, endTime)
          } catch (error) {
            event.reply('streaming-error', { streamId, message: error.message })
          }
        })

        streams.set(streamId, { scheduledJob: job })
        event.reply('stream-scheduled', streamId)
      }
    } catch (error) {
      event.reply('scheduling-error', { streamId, message: error.message })
    }
  }
)

// Stop streaming
ipcMain.on('stop-stream', (event, streamId) => {
  const streamData = streams.get(streamId)
  if (!streamData) return

  if (streamData.durationTimeout) {
    clearTimeout(streamData.durationTimeout)
  }

  if (streamData.stream) {
    streamData.stream.kill()
  }

  if (streamData.scheduledJob) {
    streamData.scheduledJob.cancel()
  }

  streams.delete(streamId)
  sendToMainWindow('streaming-stopped', streamId)
})
