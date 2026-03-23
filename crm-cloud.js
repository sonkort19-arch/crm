/**
 * Supabase: загрузка, debounced upsert, realtime.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let client = null;
let persistTimer = null;
let getStateFn = null;
const DEBOUNCE_MS = 380;

const TABLE = 'app_state';
const ROW_ID = 'main';

function validateConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'no_config' };
  const url = String(raw.supabaseUrl || '').trim();
  const key = String(raw.supabaseAnonKey || '').trim();
  if (!url || !key) return { ok: false, reason: 'missing_fields' };
  if (url.includes('YOUR_PROJECT_REF') || key.includes('YOUR_SUPABASE_ANON_KEY')) {
    return { ok: false, reason: 'placeholder_values' };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      return { ok: false, reason: 'invalid_url' };
    }
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  return { ok: true, url, key };
}

export function isConfigured() {
  const c = typeof window !== 'undefined' ? window.CRM_CONFIG : null;
  return validateConfig(c).ok;
}

export function setStateGetter(fn) {
  getStateFn = fn;
}

export function schedulePersist() {
  if (!client || typeof getStateFn !== 'function') return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersist().catch((err) => {
      console.error('CRM cloud persist', err);
      if (typeof window.__crmCloudPersistError === 'function') {
        window.__crmCloudPersistError(err);
      }
    });
  }, DEBOUNCE_MS);
}

async function flushPersist() {
  if (!client || !getStateFn) return;
  const { percentages, salary } = getStateFn();
  const { error } = await client.from(TABLE).upsert(
    {
      id: ROW_ID,
      percentages,
      salary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

/**
 * @param {{ onRow: (row: object) => void }} options
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function initCrmCloud(options) {
  const { onRow } = options;
  const cfg = validateConfig(typeof window !== 'undefined' ? window.CRM_CONFIG : null);
  if (!cfg.ok) {
    return { ok: false, error: cfg.reason };
  }
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.from(TABLE).select('*').eq('id', ROW_ID).maybeSingle();
  if (error) {
    console.error('CRM cloud load', error);
    return { ok: false, error: error.message || 'load_failed' };
  }

  if (data) {
    onRow(data);
  }

  const channel = client
    .channel('crm-app-state')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const row = payload.new;
        if (row && typeof row === 'object') {
          onRow(row);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('CRM realtime channel error');
      }
    });

  if (typeof window !== 'undefined') {
    window.__crmRealtimeChannel = channel;
  }

  return { ok: true };
}
