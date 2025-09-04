<script lang="ts">
	type Variant = 'primary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	let {
		variant = 'ghost' as Variant,
		size = 'md' as Size,
		type = 'button',
		disabled = false,
		class: klass = '',
		children,
		onclick,
		...rest
	} = $props();

	const base =
		'inline-flex items-center justify-center rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:opacity-50 disabled:pointer-events-none';

	const sizeCls = $derived(size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm');

	const variantCls = $derived(() => {
		if (variant === 'primary')
			return 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 active:bg-zinc-900';
		if (variant === 'danger')
			return 'bg-red-900/20 border-red-900/50 text-red-300 hover:bg-red-900/30';
		return 'bg-transparent border-zinc-800 hover:bg-zinc-900';
	});

	const cls = $derived(`${base} ${sizeCls} ${variantCls} ${klass}`.trim());
</script>

<button {type} {disabled} class={cls} {onclick} {...rest}>
	{@render children?.()}
</button>
