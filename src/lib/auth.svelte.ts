import { supabase } from '$lib/supabaseClient';

class AuthStore {
  user = $state(null);
  loading = $state(true);

  async initialize() {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    this.user = session?.user ?? null;
    this.loading = false;

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user ?? null;
      this.loading = false;
    });

    return () => subscription.unsubscribe();
  }
}

export const auth = new AuthStore();
