<script>
  /**
   * @typedef {Object} Props
   * @property {string} [label]
   * @property {string} [id]
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { label = '', id = '', children } = $props()
</script>

<div class="form-group">
  <label for={id}>{label}</label>
  {@render children?.()}
</div>

<style>
  .form-group {
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 1fr 3fr;
    align-items: start;
    gap: 10px;
  }
  label {
    margin: 4px 0;
    text-align: right;
  }
</style>
