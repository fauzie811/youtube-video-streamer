<script>
  let { items = [], listItem, onitemclick } = $props()
</script>

<ul class="list" role="list">
  {#each items as item}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <li
      class="list-item"
      onclick={() => onitemclick(item)}
      onkeydown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onitemclick(item)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          const next = e.target.nextElementSibling
          if (next) next.focus()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          const prev = e.target.previousElementSibling
          if (prev) prev.focus()
        }
      }}
      role="listitem"
      tabindex="0"
    >
      {#if listItem}
        {@render listItem(item)}
      {:else}
        <p>{item}</p>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .list {
    background: var(--input-background);
    list-style: none;
    padding: 0;
    overflow-y: auto;
  }
  .list-item {
    cursor: default;
    position: relative;
  }
  .list-item:focus-visible {
    outline: none;
  }
  .list-item:focus-visible::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    border: 1px solid var(--color-accent);
  }
</style>
