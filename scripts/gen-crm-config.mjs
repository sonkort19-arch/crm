/**
 * Сборка для Render: создаёт crm-config.js из переменных окружения.
 * Локально без env используйте свой crm-config.js (см. crm-config.example.js).
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Нужны переменные SUPABASE_URL и SUPABASE_ANON_KEY (например в Render → Environment).');
  process.exit(1);
}

const content = `window.CRM_CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
};
`;

writeFileSync(join(root, 'crm-config.js'), content, 'utf8');
console.log('OK: записан crm-config.js');
