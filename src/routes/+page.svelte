<script>
	import { supabase } from '$lib/supabaseClient';
	import { Github } from 'lucide-svelte';
	import { getContext } from 'svelte';

	const auth = getContext('auth');

	async function signInWithGitHub() {
		await supabase.auth.signInWithOAuth({
			provider: 'github',
			options: { redirectTo: `${location.origin}/` }
		});
	}

	async function signOut() {
		await supabase.auth.signOut();
	}
	// Access as auth.user
</script>

<main class="flex min-h-screen items-center justify-center bg-gray-900 text-white">
	{#if auth.user}
		<div class="text-center">
			<h1 class="mb-4 text-2xl font-bold">You're authenticated!</h1>
			<p class="mb-4">Welcome, {auth.user.user_metadata.full_name}</p>
			<button onclick={signOut} class="rounded bg-red-600 px-4 py-2 hover:bg-red-700">
				Sign Out
			</button>
		</div>
	{:else}
		<button
			onclick={signInWithGitHub}
			class="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-6 py-3 transition-colors hover:bg-gray-700"
		>
			<Github size={20} />
			Sign in with GitHub
		</button>
	{/if}
</main>
