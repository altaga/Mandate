import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2 && !line.startsWith('#')) {
      const k = parts[0].trim();
      const v = parts[1].trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}
