<script>
  export let disabled = false
  export let variant = 'default' // default, stop, selected
  export let type = 'button'
</script>

<button
  {type}
  {disabled}
  class:selected={variant === 'selected'}
  class:stop={variant === 'stop'}
  on:click
>
  <slot />
</button>

<style>
  button {
    font: inherit;
    color: black;
    background: #e1e1e1;
    border: 1px solid #adadad;
    padding: 8px 10px;
  }
  button:focus {
    outline: none;
    border-color: #4caf50;
  }
  button:hover {
    background-color: white;
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
  button.stop {
    background-color: #f44336;
    color: white;
  }
  button.stop:hover {
    background-color: #e53935;
  }
  button.stop:disabled {
    background-color: #cccccc;
    color: #999;
  }
</style>
