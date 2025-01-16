// index.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import schedule from 'node-schedule';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow;
let streamingJob;
let currentStream;
let durationTimeout;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
    },
  });

  mainWindow.loadFile(join(__dirname, 'index.html'));
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
    currentStream = ffmpeg(videoPath)
      .inputOptions([
        '-stream_loop',
        '-1', // Loop input indefinitely
        '-re', // Read input at native frame rate
      ])
      .outputOptions([
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-b:v',
        '3000k',
        '-maxrate',
        '3000k',
        '-bufsize',
        '6000k',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ar',
        '44100',
        '-f',
        'flv',
        '-flvflags',
        'no_duration_filesize', // Prevent issues with looping
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
          mainWindow.webContents.send('streaming-stopped');
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
          await startStreaming(videoPath, streamKey, duration);
          event.reply('streaming-started');
        } catch (error) {
          event.reply('streaming-error', error.message);
        }
      } else {
        // Schedule for future time
        streamingJob = schedule.scheduleJob(scheduledTime, async () => {
          try {
            await startStreaming(videoPath, streamKey, duration);
            event.reply('streaming-started');
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
  mainWindow.webContents.send('streaming-stopped');
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
