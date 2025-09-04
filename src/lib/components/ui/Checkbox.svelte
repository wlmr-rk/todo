<script lang="ts">
	let { checked = $bindable(false), ariaLabel = 'Toggle', class: klass = '', onchange } = $props();

	function toggle() {
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	type="button"
	role="checkbox"
	aria-checked={checked}
	aria-label={ariaLabel}
	onclick={toggle}
	class={`grid h-5 w-5 place-items-center rounded border border-zinc-800 bg-zinc-950 text-zinc-100 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:outline-none ${klass}`}
>
	{#if checked}
		<!-- minimal check -->
		<svg viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none">
			<path
				d="M5 10.5 8.5 14 15 6"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>
