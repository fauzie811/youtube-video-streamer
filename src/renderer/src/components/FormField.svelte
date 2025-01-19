<script>
  export let label = ''
  export let id = ''
</script>

<div class="form-group">
  <label for={id}>{label}</label>
  <slot />
</div>

<style>
  .form-group {
    margin-bottom: 10px;
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: start;
    gap: 10px;
  }
  label {
    margin: 8px 0;
    text-align: right;
  }
</style>
