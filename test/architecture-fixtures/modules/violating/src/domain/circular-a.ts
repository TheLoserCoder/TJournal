// Intentional violation: circular dependency with circular-b.
import { b } from './circular-b';

export const a = b;
