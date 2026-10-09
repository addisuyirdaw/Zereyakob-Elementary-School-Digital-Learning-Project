import fs from 'fs';
import path from 'path';

// Import our action
import { parseKhanUpload } from './src/app/dashboard/khan-data/actions.ts';
// Wait, we can't easily import a Next.js action in a raw Node script because it expects Next.js runtime and aliased imports.
