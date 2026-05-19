import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iyhlqxrllnkcsdbkbrui.supabase.co';
const supabaseKey = 'sb_publishable_S0hYS0qW_VVe2aikEwQzfg_BXbO52wV';

export const supabase = createClient(supabaseUrl, supabaseKey);