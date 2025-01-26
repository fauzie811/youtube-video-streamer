<script>
  /**
   * @typedef {Object} Props
   * @property {Object} [stream]
   */

  /** @type {Props} */
  let { stream = null } = $props()

  function copyText() {
    window.api.clipboard.writeText(stream.statusText)
    alert('Message copied to clipboard.')
  }
</script>

<div id="statusBar">
  {#if stream}
    <div id="statusLight" class={stream.status}></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div id="statusText" onclick={copyText}>
      {stream.statusText}
    </div>
  {/if}
</div>

<style>
  #statusBar {
    align-items: center;
    border-top: 1px solid var(--divider);
    display: flex;
    font-size: 8pt;
    gap: 5px;
    height: 22px;
    padding: 0 5px;
  }
  #statusLight {
    border-radius: 50%;
    flex-shrink: 0;
    width: 12px;
    height: 12px;
  }
  #statusLight.ready {
    background-color: var(--color-ready);
  }
  #statusLight.scheduled {
    background-color: var(--color-scheduled);
  }
  #statusLight.streaming {
    background-color: var(--color-streaming);
  }
  #statusLight.error {
    background-color: var(--color-error);
  }
  #statusText {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
</style>
