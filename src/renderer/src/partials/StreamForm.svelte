<script>
  import MaskInput from 'svelte-input-mask/MaskInput.svelte'
  import Button from '../components/Button.svelte'
  import FormField from '../components/FormField.svelte'
  import streams from '../stores/streams'
  const {
    stream = null,
    selectVideo = () => {},
    scheduleStream = () => {},
    stopStream = () => {}
  } = $props()
</script>

<FormField label="Channel / Title:" id="videoTitle">
  <input
    type="text"
    id="videoTitle"
    value={stream.videoTitle}
    disabled={stream.status !== 'ready'}
    oninput={(e) => {
      $streams = $streams.map((s) =>
        s.id === stream.id ? { ...s, videoTitle: e.target.value } : s
      )
    }}
  />
</FormField>

<FormField label="Video File:" id="videoFile">
  <div class="file-group">
    <input
      type="text"
      id="videoFile"
      value={stream.videoFile}
      disabled={stream.status !== 'ready'}
      ondrop={(e) => {
        e.preventDefault()
        if (stream.status !== 'ready') return
        const file = e.dataTransfer.files[0]
        if (file) {
          $streams = $streams.map((s) => (s.id === stream.id ? { ...s, videoFile: file.path } : s))
        }
      }}
      oninput={(e) => {
        $streams = $streams.map((s) =>
          s.id === stream.id ? { ...s, videoFile: e.target.value } : s
        )
      }}
    />
    <Button onclick={selectVideo} disabled={stream.status !== 'ready'}>Browse</Button>
  </div>
</FormField>

<FormField label="Stream Key:" id="streamKey">
  <input
    type="text"
    id="streamKey"
    value={stream.streamKey}
    disabled={stream.status !== 'ready'}
    oninput={(e) => {
      $streams = $streams.map((s) => (s.id === stream.id ? { ...s, streamKey: e.target.value } : s))
    }}
  />
</FormField>

<FormField label="Start Time:" id="startTime">
  <input
    type="datetime-local"
    id="startTime"
    value={stream.startTime}
    step="1"
    disabled={stream.status !== 'ready'}
    oninput={(e) => {
      $streams = $streams.map((s) => (s.id === stream.id ? { ...s, startTime: e.target.value } : s))
    }}
  />
</FormField>

<FormField label="End Type:" id="endType">
  <div class="button-group">
    <Button
      variant={stream.isEndByDuration ? 'selected' : 'default'}
      onclick={() => {
        $streams = $streams.map((s) => (s.id === stream.id ? { ...s, isEndByDuration: true } : s))
      }}
      disabled={stream.status !== 'ready'}
    >
      Duration
    </Button>
    <Button
      variant={!stream.isEndByDuration ? 'selected' : 'default'}
      onclick={() => {
        $streams = $streams.map((s) => (s.id === stream.id ? { ...s, isEndByDuration: false } : s))
      }}
      disabled={stream.status !== 'ready'}
    >
      Date & Time
    </Button>
  </div>
</FormField>

{#if stream.isEndByDuration}
  <FormField label="Duration:" id="duration">
    <MaskInput
      value={stream.duration}
      mask="00:00:00"
      maskString="00:00:00"
      type="text"
      on:change={({ detail }) => {
        const value = detail.inputState.maskedValue
        $streams = $streams.map((s) => (s.id === stream.id ? { ...s, duration: value } : s))
      }}
    />
  </FormField>
{:else}
  <FormField label="End Time:" id="endTime">
    <div class="file-group">
      <input
        type="datetime-local"
        id="endTime"
        value={stream.endTime}
        step="1"
        disabled={stream.status === 'scheduled'}
        oninput={(e) => {
          $streams = $streams.map((s) =>
            s.id === stream.id ? { ...s, endTime: e.target.value } : s
          )
        }}
      />
      {#if stream.status === 'streaming'}
        <Button
          onclick={() =>
            window.electron.ipcRenderer.send('update-stream-end', {
              streamId: stream.id,
              endTime: stream.endTime
            })}
        >
          Update
        </Button>
      {/if}
    </div>
  </FormField>
{/if}

<FormField label=" ">
  <div class="button-group">
    <Button onclick={() => scheduleStream(stream.id)} disabled={stream.status !== 'ready'}>
      Start / Schedule
    </Button>
    <Button
      variant="stop"
      onclick={() => stopStream(stream.id)}
      disabled={stream.status === 'ready'}
    >
      Stop
    </Button>
  </div>
</FormField>

<div class="log-container">
  <textarea
    id="logOutput"
    aria-label="Log Output:"
    readonly
    value={stream.logs?.join('\n') || ''}
    rows="5"
  ></textarea>
</div>

<style>
  :global(input),
  :global(textarea) {
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
  textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 8pt;
    padding: 6px;
  }
</style>
