<script lang="ts">
	let {
		value = $bindable(''),
		placeholder = '',
		type = 'text',
		name,
		id,
		class: klass = '',
		onkeydown,
		oninput,
		...rest
	} = $props();

	const base =
		'w-full rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600';
</script>

<input
	{type}
	{name}
	{id}
	class={`${base} ${klass}`}
	{placeholder}
	bind:value
	{onkeydown}
	{oninput}
	{...rest}
/>
