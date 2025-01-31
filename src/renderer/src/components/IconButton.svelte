<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [disabled]
   * @property {string} [type]
   * @property {string} [title]
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { disabled = false, type = 'button', title, onclick, children } = $props()
</script>

<button {type} {title} {disabled} {onclick}>
  {@render children?.()}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
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
