<!-- TodoItem.svelte -->
<script lang="ts">
	import type { Task } from '$lib/server/db/schema';
	import { Check, ChevronDown, ChevronRight, Edit3, Trash2 } from 'lucide-svelte';

	type Props = {
		task: Task;
		depth: number;
		isExpanded?: boolean;
		hasChildren?: boolean;
		onToggle: (id: string) => void;
		onEdit: (id: string, text: string) => void;
		onDelete: (id: string) => void;
		onPromote: (id: string) => void;
		onDemote: (id: string) => void;
		onToggleExpand?: (id: string) => void;
	};

	let {
		task,
		depth,
		isExpanded = true,
		hasChildren = false,
		onToggle,
		onEdit,
		onDelete,
		onPromote,
		onDemote,
		onToggleExpand
	}: Props = $props();

	let editing = $state(false);
	let editText = $state(task.text);

	function startEdit() {
		editing = true;
		editText = task.text;
	}

	function saveEdit() {
		const trimmed = editText.trim();
		if (trimmed && trimmed !== task.text) {
			onEdit(task.id, trimmed);
		}
		editing = false;
	}

	function cancelEdit() {
		editText = task.text;
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}
</script>

<div
	class="group flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 transition-colors hover:bg-gray-900"
	style="margin-left: {depth * 24}px"
>
	<!-- Expand/Collapse for parents -->
	{#if hasChildren}
		<button
			onclick={() => onToggleExpand?.(task.id)}
			class="rounded p-1 transition-colors hover:bg-gray-700"
		>
			{#if isExpanded}
				<ChevronDown size={16} class="text-gray-400" />
			{:else}
				<ChevronRight size={16} class="text-gray-400" />
			{/if}
		</button>
	{:else}
		<div class="w-6"></div>
	{/if}

	<!-- Checkbox -->
	<button
		onclick={() => onToggle(task.id)}
		class="flex h-5 w-5 items-center justify-center rounded border-2 transition-colors
			{task.completed ? 'border-blue-600 bg-blue-600' : 'border-gray-600 hover:border-gray-500'}"
	>
		{#if task.completed}
			<Check size={12} class="text-white" />
		{/if}
	</button>

	<!-- Task text -->
	<div class="min-w-0 flex-1">
		{#if editing}
			<input
				bind:value={editText}
				onkeydown={handleKeydown}
				onblur={saveEdit}
				class="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
				autofocus
			/>
		{:else}
			<button
				onclick={startEdit}
				class="w-full truncate text-left text-sm transition-colors hover:text-white
					{task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}"
			>
				{task.text}
			</button>
		{/if}
	</div>

	<!-- Due date -->
	{#if task.due_date}
		<span class="text-xs text-gray-500">
			{new Date(task.due_date).toLocaleDateString()}
		</span>
	{/if}

	<!-- Actions -->
	<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
		{#if depth > 0}
			<button
				onclick={() => onPromote(task.id)}
				class="rounded p-1 transition-colors hover:bg-gray-700"
				title="Promote (outdent)"
			>
				<ChevronRight size={14} class="rotate-180 text-gray-400" />
			</button>
		{/if}

		{#if depth < 2}
			<button
				onclick={() => onDemote(task.id)}
				class="rounded p-1 transition-colors hover:bg-gray-700"
				title="Demote (indent)"
			>
				<ChevronRight size={14} class="text-gray-400" />
			</button>
		{/if}

		<button
			onclick={startEdit}
			class="rounded p-1 transition-colors hover:bg-gray-700"
			title="Edit"
		>
			<Edit3 size={14} class="text-gray-400" />
		</button>

		<button
			onclick={() => onDelete(task.id)}
			class="rounded p-1 transition-colors hover:bg-red-700"
			title="Delete"
		>
			<Trash2 size={14} class="text-red-400" />
		</button>
	</div>
</div>
