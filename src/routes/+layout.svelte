<script>
	import { auth } from '$lib/auth.svelte.js';
	import { setContext } from 'svelte';
	import '../app.css';

	let { children } = $props();
	setContext('auth', auth);
</script>

{#if auth.loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
	</div>
{:else}
	{@render children()}
{/if}
