<script lang="ts">
	import TodoList from '$lib/components/TodoList.svelte';
</script>

<svelte:head>
	<title>Todos</title>
</svelte:head>

<div class="min-h-dvh bg-zinc-950 text-zinc-100">
	<main class="mx-auto max-w-xl p-6">
		<TodoList />
	</main>
</div>
