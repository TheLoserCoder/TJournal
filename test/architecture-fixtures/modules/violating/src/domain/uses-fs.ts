// Intentional violation: a domain module must not import the filesystem.
import { readFileSync } from 'node:fs';

export const read = (file: string): string => readFileSync(file, 'utf8');
