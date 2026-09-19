import { z } from 'zod';

import type { ApplicationSettingsDto } from './desktop-api';

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettingsDto = {
  languageMode: 'system',
  tableLayouts: [],
  themeMode: 'auto',
  tradeSummary: { followTableFilters: false, metric: 'cash', period: 'all' },
};

const tableIdentifierSchema = z.enum(['trades', 'accounts', 'assets']);
const tableDisplayModeSchema = z.enum(['advanced', 'compact']);
const tableColumnLayoutSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  width: z.number().finite().positive(),
});

export const applicationSettingsSchema = z.object({
  languageMode: z.enum(['en', 'ru', 'system']),
  tableLayouts: z.array(
    z.object({
      columns: z.array(tableColumnLayoutSchema),
      id: tableIdentifierSchema,
      mode: tableDisplayModeSchema,
      order: z.array(z.string().min(1)),
    }),
  ),
  themeMode: z.enum(['auto', 'dark', 'light']),
  tradeSummary: z.object({
    followTableFilters: z.boolean(),
    metric: z.enum(['cash', 'percent', 'r']),
    period: z.enum([
      'all',
      'current-day',
      'current-month',
      'current-quarter',
      'current-week',
      'current-year',
    ]),
  }),
});
