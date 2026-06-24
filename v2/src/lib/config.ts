// @ts-nocheck
import * as supabaseJs from '@supabase/supabase-js';

// ============================================================
// Supabase設定
// ============================================================
export const SUPABASE_URL  = 'https://rzfprialypdoyklfwpyg.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZnByaWFseXBkb3lrbGZ3cHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzQ3NzAsImV4cCI6MjA5MDkxMDc3MH0.qRzCmMetxe3tvSlIJx-HX_SHRG5Evos4D9KOEnarNfE';

export const _sb = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// 店舗ID定義
// ============================================================
export const DEFAULT_STORE_ID = '11111111-0000-0000-0000-000000000001';

export const STORE_CODE_MAP = {
  'herroom':   '11111111-0000-0000-0000-000000000001',
  'remens':    '22222222-0000-0000-0000-000000000002',
  'premium':   '33333333-0000-0000-0000-000000000003',
  'neverland': '44444444-0000-0000-0000-000000000004',
  'iwaki':     '11111111-0000-0000-0000-000000000001',
  'mito':      '22222222-0000-0000-0000-000000000002',
  'kamisu':    '33333333-0000-0000-0000-000000000003',
  '1':         '11111111-0000-0000-0000-000000000001',
  '2':         '22222222-0000-0000-0000-000000000002',
  '3':         '33333333-0000-0000-0000-000000000003',
  '4':         '44444444-0000-0000-0000-000000000004',
};

export const STORE_ID_TO_CODE = {
  '11111111-0000-0000-0000-000000000001': 'iwaki',
  '22222222-0000-0000-0000-000000000002': 'mito',
  '33333333-0000-0000-0000-000000000003': 'kamisu',
  '44444444-0000-0000-0000-000000000004': 'neverland',
};

// ============================================================
// VPS設定（シフト自動連携）
// ============================================================
export const VPS_BASE_URL = ''; // 例: 'http://123.456.789.0'
export const VPS_API_KEY  = '';

export const STORE_KEY_MAP = {
  '11111111-0000-0000-0000-000000000001': 'herroom',
  '22222222-0000-0000-0000-000000000002': 're_mens',
  '33333333-0000-0000-0000-000000000003': 'premium',
  '44444444-0000-0000-0000-000000000004': 'neverland',
};

export const STORE_SITES = {
  'herroom':   { tamashii: true,  ranking: false, homepage: true },
  're_mens':   { tamashii: true,  ranking: true,  homepage: true },
  'premium':   { tamashii: true,  ranking: true,  homepage: false },
  'neverland': { tamashii: true,  ranking: true,  homepage: false },
};
