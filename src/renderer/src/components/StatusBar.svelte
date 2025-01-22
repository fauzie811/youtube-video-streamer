<script>
  /**
   * @typedef {Object} Props
   * @property {Object} [stream]
   */

  /** @type {Props} */
  let { stream = null } = $props()
</script>

<div id="statusBar">
  {#if stream}
    <div id="statusLight" class={stream.status}></div>
    <div id="statusText">{stream.statusText}</div>
  {/if}
</div>

<style>
  #statusBar {
    align-items: center;
    border-top: 1px solid var(--divider);
    display: flex;
    font-size: 8pt;
    gap: 5px;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 22px;
    padding: 0 5px;
  }
  #statusLight {
    border-radius: 50%;
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
</style>
