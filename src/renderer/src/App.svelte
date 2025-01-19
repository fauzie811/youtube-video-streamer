<script>
  import { onDestroy } from 'svelte'
  import FormField from './components/FormField.svelte'
  import StatusBar from './components/StatusBar.svelte'
  import Button from './components/Button.svelte'

  let videoTitle = ''
  let videoFile = ''
  let streamKey = ''
  let startTime = ''
  let duration = '01:00:00'
  let endTime = ''
  let isEndByDuration = true
  let statusText = 'Ready'
  let statusColor = 'gray'
  let isStreaming = false
  let countdownInterval
  let streamTimer
  let streamStartTime

  // Handle video file selection
  async function selectVideo() {
    const file = await window.electron.ipcRenderer.invoke('select-video')
    if (file) {
      videoFile = file
    }
  }

  function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60)
    const minutes = Math.floor((ms / (1000 * 60)) % 60)
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))

    const parts = []
    if (days > 0) parts.push(`${days} days`)
    if (hours > 0) parts.push(`${hours} hours`)
    if (minutes > 0) parts.push(`${minutes} minutes`)
    parts.push(`${seconds} seconds`)

    return parts.join(', ')
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  function updateCountdown(targetDate) {
    if (countdownInterval) clearInterval(countdownInterval)

    function updateTimer() {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const difference = target - now

      if (difference <= 0) {
        clearInterval(countdownInterval)
        statusText = 'Ready'
        statusColor = 'gray'
        return
      }

      statusText = `Stream starts in: ${formatTime(difference)}`
      statusColor = 'yellow'
    }

    updateTimer()
    countdownInterval = setInterval(updateTimer, 1000)
  }

  function startStreamTimer() {
    streamStartTime = Date.now()
    if (streamTimer) clearInterval(streamTimer)

    function updateTimer() {
      const elapsedSeconds = Math.floor((Date.now() - streamStartTime) / 1000)
      statusText = `Streaming for: ${formatDuration(elapsedSeconds)}`
      statusColor = 'green'
    }

    updateTimer()
    streamTimer = setInterval(updateTimer, 1000)
  }

  function stopStreamTimer() {
    if (streamTimer) {
      clearInterval(streamTimer)
      streamTimer = null
    }
  }

  function scheduleStream() {
    if (!videoFile || !streamKey || !startTime || (!duration && !endTime)) {
      alert('Please fill in all fields')
      return
    }

    isStreaming = true

    const scheduledTime = new Date(startTime)
    if (scheduledTime > new Date()) {
      updateCountdown(startTime)
    }

    let durationSeconds = null
    if (isEndByDuration) {
      const [hours, minutes, seconds] = duration.split(':').map(Number)
      durationSeconds = hours * 3600 + minutes * 60 + (seconds || 0)
    }

    window.electron.ipcRenderer.send('schedule-stream', {
      videoPath: videoFile,
      streamKey,
      startTime,
      duration: durationSeconds,
      endTime: isEndByDuration ? null : endTime
    })
  }

  function stopStream() {
    window.electron.ipcRenderer.send('stop-stream')
    isStreaming = false
    if (countdownInterval) clearInterval(countdownInterval)
  }

  // IPC Event Listeners
  window.electron.ipcRenderer.on('streaming-started', () => {
    isStreaming = true
    startStreamTimer()
    if (countdownInterval) clearInterval(countdownInterval)
  })

  window.electron.ipcRenderer.on('streaming-stopped', () => {
    statusText = 'Ready'
    statusColor = 'gray'
    isStreaming = false
    stopStreamTimer()
    if (countdownInterval) clearInterval(countdownInterval)
  })

  window.electron.ipcRenderer.on('streaming-error', (event, message) => {
    statusText = `Streaming error: ${message}`
    statusColor = 'red'
    stopStreamTimer()
  })

  window.electron.ipcRenderer.on('scheduling-error', (event, message) => {
    statusText = `Scheduling error: ${message}`
    statusColor = 'red'
  })

  onDestroy(() => {
    if (countdownInterval) clearInterval(countdownInterval)
    if (streamTimer) clearInterval(streamTimer)
  })
</script>

<FormField label="Channel / Title:" id="videoTitle">
  <input type="text" id="videoTitle" bind:value={videoTitle} disabled={isStreaming} />
</FormField>

<FormField label="Video File:" id="videoFile">
  <div class="file-group">
    <input type="text" id="videoFile" bind:value={videoFile} disabled={isStreaming} />
    <Button on:click={selectVideo} disabled={isStreaming}>Browse</Button>
  </div>
</FormField>

<FormField label="Stream Key:" id="streamKey">
  <input type="text" id="streamKey" bind:value={streamKey} disabled={isStreaming} />
</FormField>

<FormField label="Start Time:" id="startTime">
  <input
    type="datetime-local"
    id="startTime"
    bind:value={startTime}
    step="1"
    disabled={isStreaming}
  />
</FormField>

<FormField label="End Type:" id="endType">
  <div class="button-group">
    <Button
      variant={isEndByDuration ? 'selected' : 'default'}
      on:click={() => (isEndByDuration = true)}
      disabled={isStreaming}
    >
      Duration
    </Button>
    <Button
      variant={!isEndByDuration ? 'selected' : 'default'}
      on:click={() => (isEndByDuration = false)}
      disabled={isStreaming}
    >
      Date & Time
    </Button>
  </div>
</FormField>

{#if isEndByDuration}
  <FormField label="Duration:" id="duration">
    <input type="time" id="duration" bind:value={duration} step="1" disabled={isStreaming} />
  </FormField>
{:else}
  <FormField label="End Time:" id="endTime">
    <input
      type="datetime-local"
      id="endTime"
      bind:value={endTime}
      step="1"
      disabled={isStreaming}
    />
  </FormField>
{/if}

<FormField label=" ">
  <div class="button-group">
    <Button on:click={scheduleStream} disabled={isStreaming}>Start / Schedule</Button>
    <Button variant="stop" on:click={stopStream} disabled={!isStreaming}>Stop</Button>
  </div>
</FormField>

<StatusBar {statusText} {statusColor} />

<style>
  input {
    width: 100%;
  }
  .file-group {
    display: flex;
    align-items: start;
    gap: 10px;
  }
  .file-group input {
    flex-grow: 1;
  }
  .button-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .button-group :global(button) {
    margin: 0;
  }
</style>
