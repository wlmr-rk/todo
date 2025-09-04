<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Trash2Icon } from 'lucide-svelte';

	type Todo = { id: string; title: string; done: boolean; createdAt: string };

	const KEY = 'qself.todos';
	let todos = $state<Todo[]>([]);
	let newTitle = $state('');
	let filter = $state<'all' | 'active' | 'done'>('all');

	// visual feedback state
	let editingId = $state<string | null>(null);
	let lastEditState = $state<'saved' | 'cancelled' | null>(null);
	let lastEditId = $state<string | null>(null);
	let lastEditTimer: number | null = null;

	if (typeof window !== 'undefined') {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) todos = JSON.parse(raw);
		} catch {}
	}
	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(KEY, JSON.stringify(todos));
		}
	});

	const visible = $derived(
		filter === 'all'
			? todos
			: filter === 'active'
				? todos.filter((t) => !t.done)
				: todos.filter((t) => t.done)
	);
	const left = $derived(todos.filter((t) => !t.done).length);
	const completed = $derived(todos.length - left);

	function add() {
		const title = newTitle.trim();
		if (!title) return;
		todos.unshift({
			id: crypto?.randomUUID?.() ?? String(Date.now()),
			title,
			done: false,
			createdAt: new Date().toISOString()
		});
		newTitle = '';
	}
	function remove(id: string) {
		todos = todos.filter((t) => t.id !== id);
	}
	function clearCompleted() {
		todos = todos.filter((t) => !t.done);
	}

	function enterEdit(container: HTMLElement, t: Todo) {
		const el = container.querySelector('[data-editable]') as HTMLDivElement | null;
		if (!el) return;
		if (editingId === t.id) return;
		editingId = t.id;
		el.setAttribute('contenteditable', 'true');
		el.focus();
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}

	function showEditResult(id: string, type: 'saved' | 'cancelled') {
		lastEditId = id;
		lastEditState = type;
		if (lastEditTimer) {
			clearTimeout(lastEditTimer);
			lastEditTimer = null;
		}
		lastEditTimer = window.setTimeout(() => {
			lastEditState = null;
			lastEditId = null;
			lastEditTimer = null;
		}, 900);
	}

	function finishEdit(el: HTMLDivElement, t: Todo) {
		el.removeAttribute('contenteditable');
		const text = el.innerText.trim();
		editingId = null;
		if (!text) {
			remove(t.id);
			showEditResult(t.id, 'saved'); // treat delete as a commit for feedback
		} else {
			if (text !== t.title) {
				t.title = text;
			}
			showEditResult(t.id, 'saved');
		}
		el.innerText = t.title;
	}

	function cancelEdit(el: HTMLDivElement, t: Todo) {
		el.removeAttribute('contenteditable');
		editingId = null;
		el.innerText = t.title;
		showEditResult(t.id, 'cancelled');
	}
</script>

<Card class="space-y-4">
	<div class="flex items-center gap-2">
		<Input
			class="flex-1"
			placeholder="What needs doing? (Enter to add)"
			bind:value={newTitle}
			onkeydown={(e: KeyboardEvent) =>
				e.key === 'Enter' && (add(), (e.currentTarget as HTMLInputElement).blur())}
			autofocus
		/>
	</div>

	<div class="flex items-center justify-between">
		<div class="flex gap-1">
			<Button
				size="sm"
				variant={filter === 'all' ? 'primary' : 'ghost'}
				onclick={() => (filter = 'all')}>All</Button
			>
			<Button
				size="sm"
				variant={filter === 'active' ? 'primary' : 'ghost'}
				onclick={() => (filter = 'active')}>Active</Button
			>
			<Button
				size="sm"
				variant={filter === 'done' ? 'primary' : 'ghost'}
				onclick={() => (filter = 'done')}>Done</Button
			>
		</div>
		<div class="text-xs text-zinc-400">{left} left</div>
	</div>

	<ul class="space-y-2">
		{#if visible.length === 0}
			<li class="text-sm text-zinc-500">Nothing here yet.</li>
		{:else}
			{#each visible as t (t.id)}
				{@const isEditing = editingId === t.id}
				{@const isSaved = lastEditId === t.id && lastEditState === 'saved'}
				{@const isCancelled = lastEditId === t.id && lastEditState === 'cancelled'}

				<li
					class={`group flex items-center gap-2 rounded-lg border bg-zinc-950 px-3 py-2 transition-colors
            ${
							isEditing
								? 'border-blue-500/70 ring-1 ring-blue-600/40 ring-inset'
								: isSaved
									? 'border-green-600/50'
									: isCancelled
										? 'border-yellow-600/50'
										: 'border-zinc-800'
						}`}
					ondblclick={(e) => {
						e.stopPropagation();
						enterEdit(e.currentTarget as HTMLElement, t);
					}}
				>
					<div
						class={`flex-1 text-sm transition-colors outline-none
              ${t.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}
              ${isEditing ? 'rounded bg-zinc-900/60 px-1 py-0.5' : ''}`}
						data-editable
						onclick={(e) => {
							const el = e.currentTarget as HTMLDivElement;
							if (el.getAttribute('contenteditable') === 'true') return;
							t.done = !t.done; // single click toggle
						}}
						onkeydown={(e: KeyboardEvent) => {
							const el = e.currentTarget as HTMLDivElement;
							if (el.getAttribute('contenteditable') !== 'true') return;
							if (e.key === 'Enter') {
								e.preventDefault();
								finishEdit(el, t);
							} else if (e.key === 'Escape') {
								cancelEdit(el, t);
							}
						}}
						onblur={(e) => {
							const el = e.currentTarget as HTMLDivElement;
							if (el.getAttribute('contenteditable') === 'true') {
								// blur = cancel per your request
								cancelEdit(el, t);
							}
						}}
					>
						{t.title}
					</div>

					{#if isEditing}
						<span class="px-1 text-[10px] text-blue-400/80">editing…</span>
					{:else if isSaved}
						<span class="px-1 text-[10px] text-green-400/80">saved</span>
					{:else if isCancelled}
						<span class="px-1 text-[10px] text-yellow-400/80">cancelled</span>
					{/if}

					<Button
						size="sm"
						variant="ghost"
						class="h-7 w-7 border border-zinc-800 p-0 text-zinc-300 hover:bg-zinc-900 hover:text-red-400"
						title="Delete"
						aria-label="Delete todo"
						onclick={(e) => {
							e.stopPropagation();
							remove(t.id);
							showEditResult(t.id, 'saved'); // feedback for delete
						}}
					>
						<Trash2Icon size={16} />
					</Button>
				</li>
			{/each}
		{/if}
	</ul>

	<div class="flex items-center justify-between pt-2">
		<div class="text-xs text-zinc-500">
			{todos.length} total · {completed} completed
		</div>
		<Button size="sm" variant="danger" onclick={clearCompleted}>Clear completed</Button>
	</div>
</Card>

<style>
	/* minimal transitions for feedback badges/borders */
	.group {
		transition:
			border-color 120ms ease,
			box-shadow 120ms ease;
	}
</style>
