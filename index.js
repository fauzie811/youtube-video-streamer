// index.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import schedule from 'node-schedule';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { stat } from 'fs/promises';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));

let mainWindow;
let streamingJob;
let currentStream;
let durationTimeout;

const VIDEO_BITRATE = '2000k';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 330,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

// Handle file selection
ipcMain.handle('select-video', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mkv'] }],
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
});

// Start streaming
function startStreaming(videoPath, streamKey, duration) {
  const streamUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;

  return new Promise((resolve, reject) => {
    // Verify file exists and is reaadable
    try {
      stat(videoPath).catch((error) => {
        reject(new Error('Video file not found or not accessible'));
      });
    } catch (error) {
      return;
    }

    currentStream = ffmpeg(videoPath)
      .inputOptions([
        '-stream_loop',
        '-1', // Loop input indefinitely
        '-re', // Read input at native frame rate
      ])
      .outputOptions([
        '-b:v',
        VIDEO_BITRATE,
        '-preset',
        'veryfast',
        '-codec',
        'copy',
        '-f',
        'flv',
      ])
      .output(streamUrl)
      .on('end', resolve)
      .on('error', reject);

    currentStream.run();

    // Set up duration timeout if specified
    if (duration) {
      durationTimeout = setTimeout(() => {
        if (currentStream) {
          currentStream.kill();
          currentStream = null;
          sendToMainWindow('streaming-stopped');
        }
      }, duration * 1000);
    }
  });
}

// Handle stream scheduling
ipcMain.on(
  'schedule-stream',
  async (event, { videoPath, streamKey, startTime, duration }) => {
    try {
      const scheduledTime = new Date(startTime);

      // Check if scheduled time is in the past
      if (scheduledTime < new Date()) {
        // Start streaming immediately
        try {
          event.reply('streaming-started');
          await startStreaming(videoPath, streamKey, duration);
        } catch (error) {
          event.reply('streaming-error', error.message);
        }
      } else {
        // Schedule for future time
        streamingJob = schedule.scheduleJob(scheduledTime, async () => {
          try {
            event.reply('streaming-started');
            await startStreaming(videoPath, streamKey, duration);
          } catch (error) {
            event.reply('streaming-error', error.message);
          }
        });
        event.reply('stream-scheduled');
      }
    } catch (error) {
      event.reply('scheduling-error', error.message);
    }
  }
);

// Stop streaming
ipcMain.on('stop-stream', () => {
  if (durationTimeout) {
    clearTimeout(durationTimeout);
    durationTimeout = null;
  }
  if (currentStream) {
    currentStream.kill();
    currentStream = null;
  }
  if (streamingJob) {
    streamingJob.cancel();
    streamingJob = null;
  }
  sendToMainWindow('streaming-stopped');
});

// Cleanup on exit
app.on('window-all-closed', () => {
  if (durationTimeout) {
    clearTimeout(durationTimeout);
  }
  if (currentStream) {
    currentStream.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function sendToMainWindow(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}
