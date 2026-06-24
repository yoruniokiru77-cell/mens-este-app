import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://rzfprialypdoyklfwpyg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZnByaWFseXBkb3lrbGZ3cHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzQ3NzAsImV4cCI6MjA5MDkxMDc3MH0.qRzCmMetxe3tvSlIJx-HX_SHRG5Evos4D9KOEnarNfE';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

export const LINE_PUSH_URL = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';

export const DEFAULT_STORE_ID = '11111111-0000-0000-0000-000000000001';

export const STORE_CODE_MAP: Record<string, string> = {
  iwaki:     '11111111-0000-0000-0000-000000000001',
  mito:      '22222222-0000-0000-0000-000000000002',
  kamisu:    '33333333-0000-0000-0000-000000000003',
  neverland: '44444444-0000-0000-0000-000000000004',
};

// mutable store context (set at login)
export const ctx = {
  storeId: DEFAULT_STORE_ID,
};
