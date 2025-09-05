<script lang="ts">
	import type { Task } from '$lib/server/db/schema';
	import { supabase } from '$lib/supabaseClient';
	import { Plus } from 'lucide-svelte';
	import { getContext } from 'svelte';
	import TodoItem from './TodoItem.svelte';

	const auth = getContext('auth');

	let tasks = $state<Task[]>([]);
	let newTaskText = $state('');
	let filter = $state<'all' | 'active' | 'completed'>('all');
	let expandedTasks = $state<Set<string>>(new Set());

	// Fetch initial tasks from the database
	$effect(() => {
		if (auth.user) {
			fetchTasks();
		}
	});

	async function fetchTasks() {
		if (!auth.user) return;
		const { data, error } = await supabase
			.from('tasks')
			.select('*')
			.eq('user_id', auth.user.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching tasks:', error);
		} else {
			tasks = data;
		}
	}

	// Build hierarchical tree structure
	function buildTaskTree(): Array<{ task: Task; children: Task[]; depth: number }> {
		const taskMap = new Map(tasks.map((task) => [task.id, task]));
		const tree: Array<{ task: Task; children: Task[]; depth: number }> = [];

		function addTaskToTree(task: Task, depth = 0): { task: Task; children: Task[]; depth: number } {
			const children = tasks
				.filter((t) => t.parent_id === task.id)
				.map((child) => addTaskToTree(child, depth + 1));
			return { task, children: children.map((c) => c.task), depth };
		}

		// Get root tasks (no parent)
		const rootTasks = tasks.filter((task) => !task.parent_id);

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

		const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & {
			id?: string;
			createdAt?: Date;
			updatedAt?: Date;
		} = {
			text,
			completed: false,
			due_date: null,
			parent_id: null,
			user_id: auth.user.id
		};

		const { data, error } = await supabase.from('tasks').insert(newTask).select();

		if (error) {
			console.error('Error adding task:', error);
		} else if (data) {
			tasks = [data[0], ...tasks];
			newTaskText = '';
		}
	}

	async function toggleTask(id: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		const newCompletedState = !task.completed;
		const newUpdatedAt = new Date();

		// Optimistic UI update
		const originalTasks = [...tasks];
		task.completed = newCompletedState;
		task.updatedAt = newUpdatedAt;

		// Cascade to children locally for immediate feedback
		function cascadeComplete(taskId: string, completed: boolean) {
			const children = tasks.filter((t) => t.parent_id === taskId);
			for (const child of children) {
				child.completed = completed;
				child.updatedAt = newUpdatedAt;
				cascadeComplete(child.id, completed);
			}
		}
		cascadeComplete(id, newCompletedState);
		tasks = [...tasks];

		// Update database
		const { error } = await supabase
			.from('tasks')
			.update({ completed: newCompletedState, updated_at: newUpdatedAt.toISOString() })
			.eq('id', id);

		if (error) {
			console.error('Error toggling task:', error);
			tasks = originalTasks; // Revert on error
		}
	}

	async function editTask(id: string, text: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		const newUpdatedAt = new Date();
		const originalText = task.text;

		// Optimistic UI update
		task.text = text;
		task.updatedAt = newUpdatedAt;
		tasks = [...tasks];

		// Update database
		const { error } = await supabase
			.from('tasks')
			.update({ text, updated_at: newUpdatedAt.toISOString() })
			.eq('id', id);

		if (error) {
			console.error('Error editing task:', error);
			task.text = originalText; // Revert on error
			tasks = [...tasks];
		}
	}

	async function deleteTask(id: string) {
		function collectTaskIds(taskId: string): string[] {
			const children = tasks.filter((t) => t.parent_id === taskId);
			const ids = [taskId];
			for (const child of children) {
				ids.push(...collectTaskIds(child.id));
			}
			return ids;
		}

		const idsToDelete = collectTaskIds(id);
		const originalTasks = [...tasks];

		// Optimistic UI update
		tasks = tasks.filter((t) => !idsToDelete.includes(t.id));

		// Update database
		const { error } = await supabase.from('tasks').delete().in('id', idsToDelete);

		if (error) {
			console.error('Error deleting task:', error);
			tasks = originalTasks; // Revert on error
		}
	}

	async function promoteTask(id: string) {
		const task = tasks.find((t) => t.id === id);
		if (!task || !task.parent_id) return;

		const parent = tasks.find((t) => t.id === task.parent_id);
		const newParentId = parent?.parent_id || null;
		const newUpdatedAt = new Date();

		const originalParentId = task.parent_id;

		// Optimistic UI update
		task.parent_id = newParentId;
		task.updatedAt = newUpdatedAt;
		tasks = [...tasks];

		// Update database
		const { error } = await supabase
			.from('tasks')
			.update({ parent_id: newParentId, updated_at: newUpdatedAt.toISOString() })
			.eq('id', id);

		if (error) {
			console.error('Error promoting task:', error);
			task.parent_id = originalParentId; // Revert on error
			tasks = [...tasks];
		}
	}

	async function demoteTask(id: string) {
		const taskIndex = tasks.findIndex((t) => t.id === id);
		if (taskIndex === -1) return;

		const task = tasks[taskIndex];

		// Find previous sibling at same level
		let prevSibling: Task | null = null;
		for (let i = taskIndex - 1; i >= 0; i--) {
			const candidate = tasks[i];
			if (candidate.parent_id === task.parent_id) {
				prevSibling = candidate;
				break;
			}
		}

		if (prevSibling) {
			const newParentId = prevSibling.id;
			const newUpdatedAt = new Date();
			const originalParentId = task.parent_id;

			// Optimistic UI update
			task.parent_id = newParentId;
			task.updatedAt = newUpdatedAt;
			expandedTasks.add(newParentId);
			tasks = [...tasks];

			// Update database
			const { error } = await supabase
				.from('tasks')
				.update({ parent_id: newParentId, updated_at: newUpdatedAt.toISOString() })
				.eq('id', id);

			if (error) {
				console.error('Error demoting task:', error);
				task.parent_id = originalParentId; // Revert on error
				tasks = [...tasks];
			}
		}
	}

	function toggleExpand(id: string) {
		if (expandedTasks.has(id)) {
			expandedTasks.delete(id);
		} else {
			expandedTasks.add(id);
		}
		expandedTasks = new Set(expandedTasks);
	}

	async function clearCompleted() {
		const completedIds = new Set<string>();
		function collectCompleted(taskId: string) {
			const task = tasks.find((t) => t.id === taskId);
			if (task?.completed) {
				completedIds.add(taskId);
				// Add all children too
				tasks
					.filter((t) => t.parent_id === taskId)
					.forEach((child) => {
						collectCompleted(child.id);
					});
			}
		}

		tasks.forEach((task) => {
			if (task.completed) collectCompleted(task.id);
		});

		const originalTasks = [...tasks];

		// Optimistic UI update
		tasks = tasks.filter((t) => !completedIds.has(t.id));

		// Update database
		const { error } = await supabase.from('tasks').delete().in('id', Array.from(completedIds));

		if (error) {
			console.error('Error clearing completed tasks:', error);
			tasks = originalTasks; // Revert on error
		}
	}

	// Initialize with expanded root tasks
	$effect(() => {
		tasks
			.filter((t) => !t.parent_id)
			.forEach((task) => {
				expandedTasks.add(task.id);
			});
	});
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="rounded-lg border border-gray-800 bg-gray-950 p-6">
		<h1 class="mb-6 text-2xl font-bold text-white">Todo List</h1>

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
