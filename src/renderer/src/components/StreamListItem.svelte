<script>
  import IconButton from './IconButton.svelte'

  const { stream, selected = false, ondelete } = $props()
</script>

<div class="item" class:selected title={stream.videoTitle || 'Untitled Stream'}>
  <div class={`status ${stream.status}`}></div>
  <div class="title">{stream.videoTitle || 'Untitled Stream'}</div>
  {#if selected}
    <IconButton
      variant="stop"
      small={true}
      onclick={(e) => {
        e.stopPropagation()
        ondelete()
      }}
      title="Delete Stream"
    >
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
        ><path
          d="m4.397 4.554.073-.084a.75.75 0 0 1 .976-.073l.084.073L12 10.939l6.47-6.47a.75.75 0 1 1 1.06 1.061L13.061 12l6.47 6.47a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L12 13.061l-6.47 6.47a.75.75 0 0 1-1.06-1.061L10.939 12l-6.47-6.47a.75.75 0 0 1-.072-.976l.073-.084-.073.084Z"
          fill="currentColor"
        /></svg
      >
    </IconButton>
  {/if}
</div>

<style>
  .item {
    min-height: 28px;
    padding: 2px 2px 2px 10px;
    display: flex;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
  }
  .item.selected {
    background-color: var(--background-color);
  }
  .title {
    flex-grow: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status {
    border-radius: 50%;
    flex-shrink: 0;
    height: 8px;
    width: 8px;
  }
  .status.ready {
    background-color: var(--color-ready);
  }
  .status.scheduled {
    background-color: var(--color-scheduled);
  }
  .status.streaming {
    background-color: var(--color-streaming);
  }
  .status.error {
    background-color: var(--color-error);
  }
</style>
