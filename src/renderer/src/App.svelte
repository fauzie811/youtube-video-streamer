<script>
  import FormField from './components/FormField.svelte'
  import StatusBar from './components/StatusBar.svelte'
  import Button from './components/Button.svelte'
  import ListView from './components/ListView.svelte'
  import StreamListItem from './components/StreamListItem.svelte'
  import IconButton from './components/IconButton.svelte'
  import streams from './stores/streams'

  let selectedStreamId = $state(null)

  // Handle video file selection
  async function selectVideo() {
    const file = await window.electron.ipcRenderer.invoke('select-video')
    if (file && selectedStream) {
      $streams = $streams.map((s) => (s.id === selectedStream.id ? { ...s, videoFile: file } : s))
    }
  }

  function createNewStream() {
    const newStream = {
      id: Date.now().toString(), // Simple unique ID
      videoTitle: '',
      videoFile: '',
      streamKey: '',
      startTime: '',
      duration: '01:00:00',
      endTime: '',
      isEndByDuration: true,
      status: 'ready', // ready, scheduled, streaming, error
      statusText: 'Ready'
    }
    $streams = [...$streams, newStream]
    selectedStreamId = newStream.id
  }

  function deleteStream(id) {
    if (confirm('Are you sure you want to delete this stream?')) {
      // Stop the stream if it's running
      if ($streams.find((s) => s.id === id)?.status === 'streaming') {
        stopStream(id)
      }
      $streams = $streams.filter((s) => s.id !== id)
      if (selectedStreamId === id) {
        selectedStreamId = $streams[0]?.id || null
      }
    }
  }

  let selectedStream = $derived($streams.find((s) => s.id === selectedStreamId))

  function scheduleStream(streamId) {
    const stream = $streams.find((s) => s.id === streamId)
    if (!stream) return

    if (
      !stream.videoFile ||
      !stream.streamKey ||
      !stream.startTime ||
      (!stream.duration && !stream.endTime)
    ) {
      alert('Please fill in all fields')
      return
    }

    let durationSeconds = null
    if (stream.isEndByDuration) {
      const [hours, minutes, seconds] = stream.duration.split(':').map(Number)
      durationSeconds = hours * 3600 + minutes * 60 + (seconds || 0)
    }

    // Update stream status
    $streams = $streams.map((s) =>
      s.id === streamId ? { ...s, status: 'scheduled', statusText: 'Scheduled' } : s
    )

    window.electron.ipcRenderer.send('schedule-stream', {
      streamId,
      videoPath: stream.videoFile,
      streamKey: stream.streamKey,
      startTime: stream.startTime,
      duration: durationSeconds,
      endTime: stream.isEndByDuration ? null : stream.endTime
    })
  }

  function stopStream(streamId) {
    window.electron.ipcRenderer.send('stop-stream', streamId)
  }

  // Modified IPC listeners to handle multiple streams
  window.electron.ipcRenderer.on('streaming-started', (event, streamId) => {
    $streams = $streams.map((s) =>
      s.id === streamId ? { ...s, status: 'streaming', statusText: 'Streaming' } : s
    )
  })

  window.electron.ipcRenderer.on('streaming-stopped', (event, streamId) => {
    $streams = $streams.map((s) =>
      s.id === streamId ? { ...s, status: 'ready', statusText: 'Ready' } : s
    )
  })

  window.electron.ipcRenderer.on('streaming-error', (event, { streamId, message }) => {
    $streams = $streams.map((s) =>
      s.id === streamId ? { ...s, status: 'error', statusText: `Error: ${message}` } : s
    )
  })
</script>

<div class="app-container">
  <div class="sidebar">
    <div class="sidebar-header">
      <p>Streams</p>
      <IconButton onclick={createNewStream} title="Add Stream">
        <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          ><path
            d="M11.75 3a.75.75 0 0 1 .743.648l.007.102.001 7.25h7.253a.75.75 0 0 1 .102 1.493l-.102.007h-7.253l.002 7.25a.75.75 0 0 1-1.493.101l-.007-.102-.002-7.249H3.752a.75.75 0 0 1-.102-1.493L3.752 11h7.25L11 3.75a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          /></svg
        >
      </IconButton>
    </div>
    <ListView
      class="streams-list"
      items={$streams}
      onitemclick={(item) => (selectedStreamId = item.id)}
    >
      {#snippet listItem(item)}
        <StreamListItem
          stream={item}
          selected={selectedStreamId === item.id}
          ondelete={() => deleteStream(item.id)}
        />
      {/snippet}
    </ListView>
  </div>

  <div class="main-content">
    {#if selectedStream}
      <FormField label="Channel / Title:" id="videoTitle">
        <input
          type="text"
          id="videoTitle"
          value={selectedStream.videoTitle}
          disabled={selectedStream.status !== 'ready'}
          oninput={(e) => {
            $streams = $streams.map((s) =>
              s.id === selectedStream.id ? { ...s, videoTitle: e.target.value } : s
            )
          }}
        />
      </FormField>

      <FormField label="Video File:" id="videoFile">
        <div class="file-group">
          <input
            type="text"
            id="videoFile"
            value={selectedStream.videoFile}
            disabled={selectedStream.status !== 'ready'}
            oninput={(e) => {
              $streams = $streams.map((s) =>
                s.id === selectedStream.id ? { ...s, videoFile: e.target.value } : s
              )
            }}
          />
          <Button onclick={selectVideo} disabled={selectedStream.status !== 'ready'}>Browse</Button>
        </div>
      </FormField>

      <FormField label="Stream Key:" id="streamKey">
        <input
          type="text"
          id="streamKey"
          value={selectedStream.streamKey}
          disabled={selectedStream.status !== 'ready'}
          oninput={(e) => {
            $streams = $streams.map((s) =>
              s.id === selectedStream.id ? { ...s, streamKey: e.target.value } : s
            )
          }}
        />
      </FormField>

      <FormField label="Start Time:" id="startTime">
        <input
          type="datetime-local"
          id="startTime"
          value={selectedStream.startTime}
          step="1"
          disabled={selectedStream.status !== 'ready'}
          oninput={(e) => {
            $streams = $streams.map((s) =>
              s.id === selectedStream.id ? { ...s, startTime: e.target.value } : s
            )
          }}
        />
      </FormField>

      <FormField label="End Type:" id="endType">
        <div class="button-group">
          <Button
            variant={selectedStream.isEndByDuration ? 'selected' : 'default'}
            onclick={() => {
              $streams = $streams.map((s) =>
                s.id === selectedStream.id ? { ...s, isEndByDuration: true } : s
              )
            }}
            disabled={selectedStream.status !== 'ready'}
          >
            Duration
          </Button>
          <Button
            variant={!selectedStream.isEndByDuration ? 'selected' : 'default'}
            onclick={() => {
              $streams = $streams.map((s) =>
                s.id === selectedStream.id ? { ...s, isEndByDuration: false } : s
              )
            }}
            disabled={selectedStream.status !== 'ready'}
          >
            Date & Time
          </Button>
        </div>
      </FormField>

      {#if selectedStream.isEndByDuration}
        <FormField label="Duration:" id="duration">
          <input
            type="time"
            id="duration"
            value={selectedStream.duration}
            step="1"
            disabled={selectedStream.status !== 'ready'}
            oninput={(e) => {
              $streams = $streams.map((s) =>
                s.id === selectedStream.id ? { ...s, duration: e.target.value } : s
              )
            }}
          />
        </FormField>
      {:else}
        <FormField label="End Time:" id="endTime">
          <input
            type="datetime-local"
            id="endTime"
            value={selectedStream.endTime}
            step="1"
            disabled={selectedStream.status !== 'ready'}
            oninput={(e) => {
              $streams = $streams.map((s) =>
                s.id === selectedStream.id ? { ...s, endTime: e.target.value } : s
              )
            }}
          />
        </FormField>
      {/if}

      <FormField label=" ">
        <div class="button-group">
          <Button
            onclick={() => scheduleStream(selectedStream.id)}
            disabled={selectedStream.status !== 'ready'}
          >
            Start / Schedule
          </Button>
          <Button
            variant="stop"
            onclick={() => stopStream(selectedStream.id)}
            disabled={selectedStream.status === 'ready'}
          >
            Stop
          </Button>
        </div>
      </FormField>
    {:else}
      <div class="no-stream-selected">
        <p>Select a stream from the sidebar or create a new one</p>
      </div>
    {/if}
  </div>

  <StatusBar stream={selectedStream} />
</div>

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
  .app-container {
    display: flex;
    height: calc(100vh - 22px);
    overflow: hidden;
  }
  .sidebar {
    width: clamp(200px, 30vw, 300px);
    border-right: 1px solid var(--divider);
    display: flex;
    flex-direction: column;
  }
  .sidebar-header {
    padding: 2px 2px 2px 10px;
    border-bottom: 1px solid var(--divider);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sidebar-header p {
    font-size: 8pt;
    text-transform: uppercase;
    margin: 0;
  }
  .sidebar :global(.list) {
    flex-grow: 1;
  }
  .main-content {
    flex-grow: 1;
    padding: 10px;
    overflow-y: auto;
  }
  .no-stream-selected {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #666;
  }
</style>
