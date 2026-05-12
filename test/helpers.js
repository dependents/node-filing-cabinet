import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);
