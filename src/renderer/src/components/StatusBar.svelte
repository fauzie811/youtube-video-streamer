<script>
  /**
   * @typedef {Object} Props
   * @property {Object} [stream]
   */

  import IconButton from './IconButton.svelte'

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
  {:else}
    <div class="placeholder"></div>
  {/if}
  <IconButton onclick={window.api.showAbout}>
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
      ><path
        d="M12 1.999c5.524 0 10.002 4.478 10.002 10.002 0 5.523-4.478 10.001-10.002 10.001-5.524 0-10.002-4.478-10.002-10.001C1.998 6.477 6.476 1.999 12 1.999Zm0 1.5a8.502 8.502 0 1 0 0 17.003A8.502 8.502 0 0 0 12 3.5Zm-.004 7a.75.75 0 0 1 .744.648l.007.102.003 5.502a.75.75 0 0 1-1.493.102l-.007-.101-.003-5.502a.75.75 0 0 1 .75-.75ZM12 7.003a.999.999 0 1 1 0 1.997.999.999 0 0 1 0-1.997Z"
        fill="currentColor"
      /></svg
    >
  </IconButton>
</div>

<style>
  #statusBar {
    align-items: center;
    border-top: 1px solid var(--divider);
    display: flex;
    font-size: 8pt;
    gap: 5px;
    height: 23px;
    padding: 0 5px;
  }
  #statusLight {
    border-radius: 50%;
    flex-shrink: 0;
    width: 11px;
    height: 11px;
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
  .placeholder {
    flex: 1;
  }
</style>
