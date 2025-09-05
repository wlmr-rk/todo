import { supabase } from '$lib/supabaseClient';

class AuthStore {
  user = $state(null);
  loading = $state(true);

  initialize() {
    // Get initial session async
    supabase.auth.getSession().then(({ data: { session } }) => {
      this.user = session?.user ?? null;
      this.loading = false;
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      this.user = session?.user ?? null;
      this.loading = false;
    });

    return () => subscription.unsubscribe();
  }
}

export const auth = new AuthStore();
