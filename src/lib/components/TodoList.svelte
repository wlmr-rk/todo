<!-- TodoList.svelte -->
<script lang="ts">
	import type { Task } from '$lib/server/db/schema';
	import { Plus } from 'lucide-svelte';
	import { getContext } from 'svelte';
	import TodoItem from './TodoItem.svelte';

	const auth = getContext('auth');

	let tasks = $state<Task[]>([]);
	let newTaskText = $state('');
	let filter = $state<'all' | 'active' | 'completed'>('all');
	let expandedTasks = $state<Set<string>>(new Set());

	// Build hierarchical tree structure
	function buildTaskTree(): Array<{ task: Task; children: Task[]; depth: number }> {
		const taskMap = new Map(tasks.map((task) => [task.id, task]));
		const tree: Array<{ task: Task; children: Task[]; depth: number }> = [];

		function addTaskToTree(task: Task, depth = 0): { task: Task; children: Task[]; depth: number } {
			const children = tasks
				.filter((t) => t.parentId === task.id)
				.map((child) => addTaskToTree(child, depth + 1));

			return { task, children: children.map((c) => c.task), depth };
		}

		// Get root tasks (no parent)
		const rootTasks = tasks.filter((task) => !task.parentId);

		function flattenTree(
			nodes: Array<{ task: Task; children: Task[]; depth: number }>
		): Array<{ task: Task; children: Task[]; depth: number }> {
			const result: Array<{ task: Task; children: Task[]; depth: number }> = [];

			for (const node of nodes) {
				result.push(node);

				// Only show children if parent is expanded
				if (expandedTasks.has(node.task.id)) {
					const childNodes = node.children.map((child) => addTaskToTree(child, node.depth + 1));
					result.push(...flattenTree(childNodes));
				}
			}

			return result;
		}

		return flattenTree(rootTasks.map((task) => addTaskToTree(task)));
	}

	const taskTree = $derived(buildTaskTree());

	const filteredTasks = $derived(
		taskTree.filter(({ task }) => {
			if (filter === 'all') return true;
			if (filter === 'active') return !task.completed;
			return task.completed;
		})
	);

	const activeTasks = $derived(tasks.filter((t) => !t.completed));

	async function addTask() {
		const text = newTaskText.trim();
		if (!text || !auth.user) return;

		const newTask: Task = {
			id: crypto.randomUUID(),
			text,
			completed: false,
			dueDate: null,
			parentId: null,
			userId: auth.user.id,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		tasks = [newTask, ...tasks];
		newTaskText = '';

		// TODO: Save to database
	}

	function toggleTask(id: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		task.completed = !task.completed;
		task.updatedAt = new Date();

		// Cascade to children
		function cascadeComplete(taskId: string, completed: boolean) {
			const children = tasks.filter((t) => t.parentId === taskId);
			for (const child of children) {
				child.completed = completed;
				child.updatedAt = new Date();
				cascadeComplete(child.id, completed);
			}
		}

		cascadeComplete(id, task.completed);
		tasks = [...tasks];

		// TODO: Save to database
	}

	function editTask(id: string, text: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		task.text = text;
		task.updatedAt = new Date();
		tasks = [...tasks];

		// TODO: Save to database
	}

	function deleteTask(id: string) {
		function collectTaskIds(taskId: string): string[] {
			const children = tasks.filter((t) => t.parentId === taskId);
			const ids = [taskId];
			for (const child of children) {
				ids.push(...collectTaskIds(child.id));
			}
			return ids;
		}

		const idsToDelete = collectTaskIds(id);
		tasks = tasks.filter((t) => !idsToDelete.includes(t.id));

		// TODO: Save to database
	}

	function promoteTask(id: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task || !task.parentId) return;

		const parent = tasks.find((t) => t.id === task.parentId);
		task.parentId = parent?.parentId || null;
		task.updatedAt = new Date();
		tasks = [...tasks];

		// TODO: Save to database
	}

	function demoteTask(id: string) {
		const taskIndex = tasks.findIndex((t) => t.id === id);
		if (taskIndex === -1) return;

		const task = tasks[taskIndex];

		// Find previous sibling at same level
		let prevSibling: Task | null = null;
		for (let i = taskIndex - 1; i >= 0; i--) {
			const candidate = tasks[i];
			if (candidate.parentId === task.parentId) {
				prevSibling = candidate;
				break;
			}
		}

		if (prevSibling) {
			task.parentId = prevSibling.id;
			task.updatedAt = new Date();

			// Ensure parent is expanded
			expandedTasks.add(prevSibling.id);

			tasks = [...tasks];
		}

		// TODO: Save to database
	}

	function toggleExpand(id: string) {
		if (expandedTasks.has(id)) {
			expandedTasks.delete(id);
		} else {
			expandedTasks.add(id);
		}
		expandedTasks = new Set(expandedTasks);
	}

	function clearCompleted() {
		const completedIds = new Set<string>();

		function collectCompleted(taskId: string) {
			const task = tasks.find((t) => t.id === taskId);
			if (task?.completed) {
				completedIds.add(taskId);
				// Add all children too
				tasks
					.filter((t) => t.parentId === taskId)
					.forEach((child) => {
						collectCompleted(child.id);
					});
			}
		}

		tasks.forEach((task) => {
			if (task.completed) collectCompleted(task.id);
		});

		tasks = tasks.filter((t) => !completedIds.has(t.id));

		// TODO: Save to database
	}

	// Initialize with expanded root tasks
	$effect(() => {
		tasks
			.filter((t) => !t.parentId)
			.forEach((task) => {
				expandedTasks.add(task.id);
			});
	});
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="rounded-lg border border-gray-800 bg-gray-950 p-6">
		<h1 class="mb-6 text-2xl font-bold text-white">Todo List</h1>

		<!-- Add new task -->
		<div class="mb-6 flex gap-2">
			<input
				bind:value={newTaskText}
				onkeydown={(e) => e.key === 'Enter' && addTask()}
				placeholder="What needs to be done?"
				class="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
			/>
			<button
				onclick={addTask}
				disabled={!newTaskText.trim()}
				class="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Plus size={20} />
			</button>
		</div>

		<!-- Filter tabs -->
		<div class="mb-6 flex items-center justify-between">
			<div class="flex gap-1">
				{#each [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }] as filterOption}
					<button
						onclick={() => (filter = filterOption.value)}
						class="rounded px-3 py-1 text-sm font-medium transition-colors
							{filter === filterOption.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}"
					>
						{filterOption.label}
					</button>
				{/each}
			</div>

			<span class="text-sm text-gray-400">
				{activeTasks.length} active
			</span>
		</div>

		<!-- Task list -->
		<div class="space-y-2">
			{#each filteredTasks as { task, children, depth } (task.id)}
				<TodoItem
					{task}
					{depth}
					isExpanded={expandedTasks.has(task.id)}
					hasChildren={children.length > 0}
					onToggle={toggleTask}
					onEdit={editTask}
					onDelete={deleteTask}
					onPromote={promoteTask}
					onDemote={demoteTask}
					onToggleExpand={toggleExpand}
				/>
			{:else}
				<div class="text-center py-12 text-gray-400">
					<div class="text-lg mb-2">No tasks found</div>
					<div class="text-sm">
						{filter === 'all' ? 'Add your first task above' : `No ${filter} tasks`}
					</div>
				</div>
			{/each}
		</div>

		<!-- Clear completed -->
		{#if tasks.some((t) => t.completed)}
			<div class="mt-6 flex justify-end">
				<button
					onclick={clearCompleted}
					class="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
				>
					Clear completed
				</button>
			</div>
		{/if}
	</div>
</div>
