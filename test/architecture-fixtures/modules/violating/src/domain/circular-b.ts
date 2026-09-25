// Intentional violation: circular dependency with circular-a.
import { a } from './circular-a';

export const b = a;
