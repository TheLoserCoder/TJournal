import type { z } from 'zod';

import { AppError } from '@tjournal/platform-errors';

export const parseIpcInput = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError({
    code: 'validation-invalid',
    issues: result.error.issues.map((issue) => ({ code: issue.code, path: issue.path.join('.') })),
    message: 'IPC input validation failed.',
  });
};
