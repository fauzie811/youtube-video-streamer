<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [disabled]
   * @property {string} [type]
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { disabled = false, type = 'button', onclick, children } = $props()
</script>

<button {type} {disabled} {onclick}>
  {@render children?.()}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    color: black;
    background: transparent;
    border: none;
    border-radius: 2px;
    padding: 4px;
  }
  button:focus-visible {
    outline: 1px solid var(--color-accent);
  }
  button:hover {
    background-color: #e1e1e1;
  }
  button:disabled {
    background-color: #cccccc;
    color: #999;
  }
</style>
