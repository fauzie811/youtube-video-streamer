<script>
  export let statusText = 'Ready'
  export let statusColor = 'gray'
</script>

<div id="statusBar">
  <div id="statusLight" class={statusColor} />
  <div id="statusText">{statusText}</div>
</div>

<style>
  #statusBar {
    align-items: center;
    background-color: #f0f0f0;
    border-top: 1px solid #ccc;
    display: flex;
    font-size: 8pt;
    gap: 5px;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 25px;
    padding: 0 5px;
  }
  #statusLight {
    border-radius: 50%;
    width: 15px;
    height: 15px;
  }
  #statusLight.gray {
    background-color: #9e9e9e;
  }
  #statusLight.yellow {
    background-color: #ffc107;
  }
  #statusLight.green {
    background-color: #4caf50;
  }
  #statusLight.red {
    background-color: #f44336;
  }
</style>
