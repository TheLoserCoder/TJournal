// Intentional violation: a module contract must not import a platform adapter.
import { AppError } from '@tjournal/platform-errors';

export const error = new AppError({ code: 'unexpected', message: 'fixture' });
