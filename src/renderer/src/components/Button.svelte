<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [disabled]
   * @property {string} [variant] - default, stop, selected
   * @property {string} [type]
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { disabled = false, variant = 'default', type = 'button', onclick, children } = $props()
</script>

<button
  {type}
  {disabled}
  class:selected={variant === 'selected'}
  class:stop={variant === 'stop'}
  {onclick}
>
  {@render children?.()}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    color: black;
    background: #e1e1e1;
    border: 1px solid #aaa;
    border-radius: 2px;
    padding: 5px 10px;
    text-align: center;
  }
  button:focus {
    outline: none;
    border-color: #4caf50;
  }
  button:hover {
    background-color: #dadada;
  }
  button:active {
    background-color: #ccc;
  }
  button:disabled {
    background-color: #cccccc;
    border-color: #bbb;
    color: #999;
  }
  button.selected {
    background-color: #4caf50;
    color: white;
    border-color: #45a049;
  }
  button.stop:not(:disabled) {
    background-color: #f44336;
    color: white;
    border-color: #d32f2f;
  }
  button.stop:hover {
    background-color: #e53935;
  }
  button.stop:disabled {
    background-color: #cccccc;
    color: #999;
  }
</style>
