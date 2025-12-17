import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ywcblcqtopiwlpyvpoos.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vfY8D9MPqiXI7uEtoOW4_A_8fs_aTBX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
