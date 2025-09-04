<script lang="ts">
	let { class: klass = '', children } = $props();
</script>

<section class={`rounded-xl border border-zinc-800 bg-zinc-950 p-4 ${klass}`}>
	{@render children?.()}
</section>
