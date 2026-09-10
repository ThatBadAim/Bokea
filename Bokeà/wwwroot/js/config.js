// Bokeà - Environment Configuration
// Paste your Supabase Project URL and Public Anon Key below. They are required:
// accounts are verified by the server, so with nothing here there is no server
// to verify against and nobody can sign in. Bokeà will say so on the sign-in
// screen rather than letting anyone past it.

window.ENV = {
  SUPABASE_URL: 'https://xwmimrocnanyjtcomlib.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_pmMBWtdSdPeDJh_PdN_GUQ_YoCEOB-A',
  VAPID_PUBLIC_KEY: 'BOOfho7XQIYjv8VoplYubn9GpOp_aSrWZYGpa5sP2bVlTzjPM4Urpsvkv9mi6OpXRuGu_M_L3hHKsuWRovip4Sc',

  // Helper to determine if Supabase BaaS is ready
  isConfigured: function () {
    return Boolean(
      this.SUPABASE_URL &&
      this.SUPABASE_ANON_KEY &&
      !this.SUPABASE_URL.includes('YOUR_PROJECT') &&
      !this.SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')
    );
  }
};
