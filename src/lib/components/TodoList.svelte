<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Trash2Icon } from 'lucide-svelte';

	type Todo = {
		id: string;
		title: string;
		done: boolean;
		parentId: string | null;
	};

	type Row = {
		todo: Todo;
		depth: number;
		index: number | null; // 1-based index among siblings if depth > 0
	};

	const KEY = 'qself.todos';
	let todos = $state<Todo[]>([]);
	let newTitle = $state('');
	let filter = $state<'all' | 'active' | 'done'>('all');
	let editing = $state<string | null>(null);

	// Gesture state
	let dragId = $state<string | null>(null);
	let startX = $state(0);
	let startY = $state(0);
	let dx = $state(0);
	let swiping = $state(false);
	const SWIPE_THRESHOLD = 64;

	// Load from localStorage + migrate to parentId
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem(KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as Array<
					Omit<Todo, 'parentId'> & { parentId?: string | null }
				>;
				todos = parsed.map((t) => ({
					id: t.id,
					title: t.title,
					done: t.done,
					parentId: t.parentId === undefined ? null : (t.parentId as string | null)
				}));
			} catch {
				todos = [];
			}
		}
	}

	// Save to localStorage
	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(KEY, JSON.stringify(todos));
		}
	});

	// Build a flat, ordered tree view (pre-order), honoring current array order
	function buildOrderedRows(list: Todo[]): Row[] {
		const byParent = new Map<string | null, Todo[]>();
		for (const t of list) {
			const pid = t.parentId ?? null;
			if (!byParent.has(pid)) byParent.set(pid, []);
			byParent.get(pid)!.push(t);
		}
		const out: Row[] = [];
		function dfs(pid: string | null, depth: number) {
			const kids = byParent.get(pid);
			if (!kids) return;
			for (let i = 0; i < kids.length; i++) {
				const k = kids[i];
				out.push({
					todo: k,
					depth,
					index: depth > 0 ? i + 1 : null
				});
				dfs(k.id, depth + 1);
			}
		}
		dfs(null, 0);
		return out;
	}

	const ordered = $derived(buildOrderedRows(todos));

	const visible = $derived(
		ordered.filter(({ todo }) => {
			if (filter === 'all') return true;
			if (filter === 'active') return !todo.done;
			return todo.done;
		})
	);

	const remaining = $derived(todos.filter((t) => !t.done).length);

	function addTodo() {
		const title = newTitle.trim();
		if (!title) return;
		todos.unshift({
			id: crypto.randomUUID(),
			title,
			done: false,
			parentId: null
		});
		newTitle = '';
	}

	// Move item after a target in the flat array (preserves relative order)
	function moveAfter(itemId: string, afterId: string) {
		if (itemId === afterId) return;
		const from = todos.findIndex((x) => x.id === itemId);
		const to = todos.findIndex((x) => x.id === afterId);
		if (from === -1 || to === -1) return;
		const [item] = todos.splice(from, 1);
		const insertAt = to < from ? to + 1 : to + 1;
		todos.splice(insertAt, 0, item);
	}

	// Subtree helpers
	function collectSubtreeIds(id: string): Set<string> {
		const set = new Set<string>();
		set.add(id);
		const childrenByParent = new Map<string, Todo[]>();
		for (const t of todos) {
			if (t.parentId) {
				if (!childrenByParent.has(t.parentId)) {
					childrenByParent.set(t.parentId, []);
				}
				childrenByParent.get(t.parentId)!.push(t);
			}
		}
		const stack = [id];
		while (stack.length) {
			const cur = stack.pop()!;
			const kids = childrenByParent.get(cur);
			if (!kids) continue;
			for (const k of kids) {
				if (!set.has(k.id)) {
					set.add(k.id);
					stack.push(k.id);
				}
			}
		}
		return set;
	}

	function removeTodoCascade(id: string) {
		const toRemove = collectSubtreeIds(id);
		todos = todos.filter((t) => !toRemove.has(t.id));
	}

	function clearCompleted() {
		// remove every done item and its descendants
		const removeSet = new Set<string>();
		for (const t of todos) {
			if (t.done) {
				for (const x of collectSubtreeIds(t.id)) removeSet.add(x);
			}
		}
		if (removeSet.size === 0) return;
		todos = todos.filter((t) => !removeSet.has(t.id));
	}

	// Editing
	function startEdit(id: string, el: HTMLSpanElement) {
		editing = id;
		el.contentEditable = 'true';
		el.focus();

		const range = document.createRange();
		range.selectNodeContents(el);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}

	function finishEdit(id: string, el: HTMLSpanElement) {
		const todo = todos.find((t) => t.id === id);
		if (!todo) return;
		const next = el.textContent?.trim() ?? '';
		if (!next) {
			removeTodoCascade(id);
		} else {
			todo.title = next;
		}
		el.contentEditable = 'false';
		editing = null;
	}

	function cancelEdit(id: string, el: HTMLSpanElement) {
		const todo = todos.find((t) => t.id === id);
		if (todo) el.textContent = todo.title;
		el.contentEditable = 'false';
		editing = null;
	}

	// Prev visible that's NOT a descendant of the given id
	function findPrevNonDescendant(id: string): Todo | null {
		const set = collectSubtreeIds(id);
		const idx = visible.findIndex((r) => r.todo.id === id);
		for (let i = idx - 1; i >= 0; i--) {
			const cand = visible[i].todo;
			if (!set.has(cand.id)) return cand;
		}
		return null;
	}

	// Promote/Demote
	function promote(id: string) {
		const t = todos.find((x) => x.id === id);
		if (!t) return;
		if (t.parentId === null) return; // already root
		const parent = todos.find((x) => x.id === t.parentId);
		t.parentId = parent ? parent.parentId : null;
	}

	function demoteUnderPrev(id: string) {
		const t = todos.find((x) => x.id === id);
		if (!t) return;
		const prev = findPrevNonDescendant(id);
		if (!prev) return; // no other todos or only descendants above
		t.parentId = prev.id;
		moveAfter(id, prev.id);
	}

	// Gestures (swipe)
	function onPointerDown(id: string, e: PointerEvent) {
		if (editing === id) return; // don't drag while editing
		dragId = id;
		swiping = false;
		dx = 0;
		startX = e.clientX;
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(id: string, e: PointerEvent) {
		if (dragId !== id) return;
		const mx = e.clientX - startX;
		const my = e.clientY - startY;
		if (!swiping) {
			if (Math.abs(mx) > 6 && Math.abs(mx) > Math.abs(my)) {
				swiping = true;
			} else {
				return;
			}
		}
		dx = mx;
	}

	function commitSwipe(id: string, dist: number) {
		if (dist <= -SWIPE_THRESHOLD) {
			// Delete row + subtree
			removeTodoCascade(id);
		} else if (dist >= SWIPE_THRESHOLD) {
			// Make child under nearest previous visible (non-descendant), if any
			const prev = findPrevNonDescendant(id);
			if (prev) {
				const t = todos.find((x) => x.id === id);
				if (t) {
					t.parentId = prev.id;
					moveAfter(id, prev.id);
				}
			}
			// If no prev, snap back (no-op)
		}
	}

	function endSwipe(id: string, e: PointerEvent) {
		if (dragId !== id) return;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		if (swiping) commitSwipe(id, dx);
		// Reset gesture state; snapping handled by inline transition
		dragId = null;
		dx = 0;
		swiping = false;
	}
</script>

<Card class="space-y-4">
	<Input
		bind:value={newTitle}
		placeholder="Add todo..."
		onkeydown={(e) => e.key === 'Enter' && addTodo()}
		autofocus
	/>

	<div class="flex items-center justify-between">
		<div class="flex gap-1">
			{#each ['all', 'active', 'done'] as f}
				<Button size="sm" variant={filter === f ? 'primary' : 'ghost'} onclick={() => (filter = f)}>
					{f}
				</Button>
			{/each}
		</div>
		<span class="text-xs text-zinc-400">{remaining} left</span>
	</div>

	<ul class="space-y-2">
		{#each visible as { todo, depth, index } (todo.id)}
			{@const isEditing = editing === todo.id}
			{@const isDragging = dragId === todo.id}
			{@const willDelete = isDragging && dx <= -SWIPE_THRESHOLD}
			{@const willIndent = isDragging && dx >= SWIPE_THRESHOLD}

			<li
				class="group relative flex items-center gap-2 rounded border
          border-zinc-800 bg-zinc-950 p-2
          {isDragging ? 'select-none' : ''}
          {willDelete ? 'ring-1 ring-red-900/60' : ''}
          {willIndent ? 'ring-1 ring-emerald-900/60' : ''}"
				style={`transform: ${isDragging ? `translateX(${dx}px)` : 'translateX(0px)'}; transition: ${
					isDragging ? 'none' : 'transform 150ms ease-out'
				}; touch-action: pan-y;`}
				onpointerdown={(e) => onPointerDown(todo.id, e)}
				onpointermove={(e) => onPointerMove(todo.id, e)}
				onpointerup={(e) => endSwipe(todo.id, e)}
				onpointercancel={(e) => endSwipe(todo.id, e)}
			>
				<!-- Row body with indentation, connectors (shoulder), and numbering -->
				<div
					class="relative flex flex-1 items-center gap-2"
					style={`padding-left: ${depth * 16}px;`}
				>
					{#if depth > 0}
						<!-- Vertical shoulder under parent -->
						<span
							class="pointer-events-none absolute top-0 bottom-0 left-2
                border-l border-zinc-800"
							aria-hidden="true"
						/>
						<!-- Elbow into this row -->
						<span
							class="pointer-events-none absolute top-1/2 left-2
                w-3 -translate-y-1/2 border-t border-zinc-800"
							aria-hidden="true"
						/>
						<!-- Sibling numbering -->
						<span
							class="w-6 shrink-0 text-right text-[11px] leading-none
                text-zinc-500"
							title="Child index"
						>
							{index}.
						</span>
					{/if}

					<Checkbox bind:checked={todo.done} ariaLabel="Mark complete" class="shrink-0" />

					<span
						class="flex-1 text-sm
              {todo.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}
              {isEditing
							? 'rounded bg-transparent px-1 caret-zinc-200 outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:outline-none'
							: 'cursor-pointer'}"
						onclick={(e) => !isEditing && startEdit(todo.id, e.currentTarget)}
						onkeydown={(e) => {
							if (!isEditing) return;
							if (e.key === 'Enter') {
								e.preventDefault();
								finishEdit(todo.id, e.currentTarget);
							} else if (e.key === 'Escape') {
								e.preventDefault();
								cancelEdit(todo.id, e.currentTarget);
							}
						}}
						onblur={(e) => isEditing && cancelEdit(todo.id, e.currentTarget)}
						title={isEditing ? 'Editing' : 'Edit'}
					>
						{todo.title}
					</span>

					<div class="flex items-center gap-1">
						<!-- Promote/Demote -->
						{#if todo.parentId !== null}
							<!-- Can promote (outdent) -->
							<Button
								size="sm"
								variant="ghost"
								class="h-7 px-2 text-zinc-400 opacity-0
                  group-hover:opacity-100 hover:text-zinc-200"
								ariaLabel="Promote todo (outdent)"
								title="Promote (outdent)"
								onclick={() => promote(todo.id)}
							>
								Promote
							</Button>
						{:else}
							{@const prevElig = findPrevNonDescendant(todo.id)}
							<Button
								size="sm"
								variant="ghost"
								class="h-7 px-2 text-zinc-400 opacity-0
                  group-hover:opacity-100 hover:text-zinc-200
                  disabled:opacity-30"
								ariaLabel="Demote todo under previous item"
								title="Demote (indent under previous)"
								disabled={!prevElig}
								onclick={() => demoteUnderPrev(todo.id)}
							>
								Demote
							</Button>
						{/if}

						<!-- Delete -->
						<Button
							size="sm"
							variant="ghost"
							class="h-7 w-7 p-0 text-zinc-400 opacity-0
                group-hover:opacity-100 hover:text-red-400"
							ariaLabel="Delete todo"
							title="Delete"
							onclick={() => removeTodoCascade(todo.id)}
						>
							<Trash2Icon size={14} />
						</Button>
					</div>
				</div>
			</li>
		{:else}
			<li class="py-4 text-center text-sm text-zinc-500">No todos yet</li>
		{/each}
	</ul>

	{#if todos.some((t) => t.done)}
		<div class="flex justify-end">
			<Button size="sm" variant="danger" onclick={clearCompleted}>Clear completed</Button>
		</div>
	{/if}
</Card>
