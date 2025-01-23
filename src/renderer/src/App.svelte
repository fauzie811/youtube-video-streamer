<script>
  import { SplitPane } from '@rich_harris/svelte-split-pane'
  import StatusBar from './components/StatusBar.svelte'
  import ListView from './components/ListView.svelte'
  import StreamListItem from './components/StreamListItem.svelte'
  import IconButton from './components/IconButton.svelte'
  import streams from './stores/streams'
  import StreamForm from './partials/StreamForm.svelte'

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
  <SplitPane type="horizontal" min="200px" max="50%" pos="30%" --color="#ccc">
    {#snippet a()}
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
    {/snippet}

    {#snippet b()}
      <div class="main-content">
        {#if selectedStream}
          <StreamForm stream={selectedStream} {selectVideo} {scheduleStream} {stopStream} />
        {:else}
          <div class="no-stream-selected">
            <p>Select a stream from the sidebar or create a new one</p>
          </div>
        {/if}
      </div>
    {/snippet}
  </SplitPane>

  <StatusBar stream={selectedStream} />
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .sidebar {
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
