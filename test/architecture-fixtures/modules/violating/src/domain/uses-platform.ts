// Intentional violation: a domain module must not import a platform adapter.
import { AppError } from '@tjournal/platform-errors';

export const error = new AppError({ code: 'unexpected', message: 'fixture' });
