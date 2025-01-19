import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
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
let streamingJob
let currentStream
let durationTimeout

const VIDEO_BITRATE = '2000k'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 360,
    resizable: false,
    show: false,
    autoHideMenuBar: true,
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
  if (durationTimeout) clearTimeout(durationTimeout)
  if (currentStream) currentStream.kill()
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
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
function startStreaming(videoPath, streamKey, duration, endTime) {
  const streamUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`

  return new Promise((resolve, reject) => {
    // Verify file exists and is readable
    try {
      stat(videoPath).catch(() => {
        reject(new Error('Video file not found or not accessible'))
      })
    } catch (error) {
      return
    }

    currentStream = ffmpeg(videoPath)
      .inputOptions([
        '-stream_loop',
        '-1', // Loop input indefinitely
        '-re' // Read input at native frame rate
      ])
      .outputOptions(['-b:v', VIDEO_BITRATE, '-preset', 'veryfast', '-codec', 'copy', '-f', 'flv'])
      .output(streamUrl)
      .on('end', resolve)
      .on('error', (err) => {
        if (err.message?.includes('SIGKILL')) {
          resolve()
        } else {
          reject(err)
        }
      })

    currentStream.run()

    // Set up duration timeout if specified
    if (duration) {
      durationTimeout = setTimeout(() => {
        if (currentStream) {
          currentStream.kill()
          currentStream = null
          sendToMainWindow('streaming-stopped')
        }
      }, duration * 1000)
    } else if (endTime) {
      const endDateTime = new Date(endTime)
      const timeUntilEnd = endDateTime.getTime() - Date.now()
      if (timeUntilEnd > 0) {
        durationTimeout = setTimeout(() => {
          if (currentStream) {
            currentStream.kill()
            currentStream = null
            sendToMainWindow('streaming-stopped')
          }
        }, timeUntilEnd)
      }
    }
  })
}

// Handle stream scheduling
ipcMain.on(
  'schedule-stream',
  async (event, { videoPath, streamKey, startTime, duration, endTime }) => {
    try {
      const scheduledTime = new Date(startTime)

      // Check if scheduled time is in the past
      if (scheduledTime < new Date()) {
        // Start streaming immediately
        try {
          event.reply('streaming-started')
          await startStreaming(videoPath, streamKey, duration, endTime)
        } catch (error) {
          event.reply('streaming-error', error.message)
        }
      } else {
        // Schedule for future time
        streamingJob = schedule.scheduleJob(scheduledTime, async () => {
          try {
            event.reply('streaming-started')
            await startStreaming(videoPath, streamKey, duration, endTime)
          } catch (error) {
            event.reply('streaming-error', error.message)
          }
        })
        event.reply('stream-scheduled')
      }
    } catch (error) {
      event.reply('scheduling-error', error.message)
    }
  }
)

// Stop streaming
ipcMain.on('stop-stream', () => {
  if (durationTimeout) {
    clearTimeout(durationTimeout)
    durationTimeout = null
  }
  if (currentStream) {
    currentStream.kill()
    currentStream = null
  }
  if (streamingJob) {
    streamingJob.cancel()
    streamingJob = null
  }
  sendToMainWindow('streaming-stopped')
})
