<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Input from '$lib/components/ui/Input.svelte';

	export interface Todo {
		id: string;
		title: string;
		done: boolean;
		createdAt: string;
	}

	let {
		todo,
		onToggle,
		onRename,
		onRemove
	}: {
		todo: Todo;
		onToggle?: (id: string, done: boolean) => void;
		onRename?: (id: string, title: string) => void;
		onRemove?: (id: string) => void;
	} = $props();

	let editing = $state(false);
	let draft = $state(todo.title);

	function commit() {
		const t = draft.trim();
		if (!t) {
			onRemove?.(todo.id);
			return;
		}
		if (t !== todo.title) onRename?.(todo.id, t);
		editing = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commit();
		if (e.key === 'Escape') {
			draft = todo.title;
			editing = false;
		}
	}
</script>

<div class="flex items-center gap-3">
	<Checkbox
		bind:checked={todo.done}
		onchange={(v) => onToggle?.(todo.id, v)}
		ariaLabel="Mark complete"
	/>

	{#if editing}
		<div class="flex flex-1 items-center gap-2">
			<Input class="flex-1" bind:value={draft} onkeydown={onKey} onblur={commit} autofocus />
			<Button variant="primary" size="sm" onclick={commit}>Save</Button>
			<Button size="sm" onclick={() => (editing = false)}>Cancel</Button>
		</div>
	{:else}
		<button
			class="flex-1 text-left text-sm outline-none"
			onclick={() => (editing = true)}
			title="Edit"
		>
			<span class={todo.done ? 'text-zinc-500 line-through' : ''}>
				{todo.title}
			</span>
		</button>

		<div class="flex items-center gap-1">
			<Button size="sm" onclick={() => (editing = true)}>Edit</Button>
			<Button size="sm" variant="danger" onclick={() => onRemove?.(todo.id)} title="Delete">
				Delete
			</Button>
		</div>
	{/if}
</div>
