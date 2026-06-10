import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Single shared client — import `sb` everywhere instead of calling createClient again.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
