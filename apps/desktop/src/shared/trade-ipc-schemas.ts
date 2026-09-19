import { z } from 'zod';

const decimalSchema = z.string().trim().min(1);
const nonNegativeDecimalSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?$/);
const directionSchema = z.enum(['long', 'short']);
const resultKindSchema = z.enum(['cash', 'percent', 'r']);
export const instrumentIdSchema = z.string().min(1);
export const accountIdSchema = z.string().min(1);
export const tradeIdSchema = z.string().min(1);
export const tradeIdsSchema = z
  .array(tradeIdSchema)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length);
export const createInstrumentSchema = z.object({
  category: z.enum(['crypto', 'energy', 'equity', 'etf', 'forex', 'index', 'metal']),
  symbol: z.string().trim().min(1),
  calculationProfile: z
    .object({ tickSize: nonNegativeDecimalSchema, tickValueUsdPerLot: nonNegativeDecimalSchema })
    .refine(({ tickSize, tickValueUsdPerLot }) => tickSize !== '0' && tickValueUsdPerLot !== '0', {
      path: ['calculationProfile'],
      message: 'Tick values must be positive.',
    })
    .nullable()
    .optional(),
});
export const updateInstrumentSchema = createInstrumentSchema.extend({ id: instrumentIdSchema });
const accountDefaultSchema = z.object({
  instrumentId: instrumentIdSchema,
  commissionUsd: nonNegativeDecimalSchema,
  spreadTicks: nonNegativeDecimalSchema,
});
export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1),
    openingBalanceUsd: nonNegativeDecimalSchema,
    defaults: z.array(accountDefaultSchema),
  })
  .refine(
    ({ defaults }) => new Set(defaults.map((item) => item.instrumentId)).size === defaults.length,
    { path: ['defaults'], message: 'Duplicate asset default.' },
  );
export const updateAccountSchema = createAccountSchema.extend({ id: accountIdSchema });
const riskBindingSchema = z.object({ kind: z.enum(['cash', 'percent']), value: decimalSchema });
const exitSchema = z.object({
  allocationKind: z.enum(['lots', 'percent']),
  allocationValue: decimalSchema,
  exitPrice: decimalSchema,
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  reportedResultKind: z.enum(['cash', 'percent']).nullable(),
  reportedResultValue: decimalSchema.nullable(),
});
const executionInputSchema = z.object({
  commissionUsd: decimalSchema,
  entryPrice: decimalSchema,
  exits: z.array(exitSchema).min(1),
  quantityLots: decimalSchema,
  spreadTicks: decimalSchema,
  stopLossPrice: decimalSchema.nullable(),
});
const executionSchema = executionInputSchema.extend({
  instrumentSnapshot: z.object({ tickSize: decimalSchema, tickValueUsdPerLot: decimalSchema }),
});

export const createTradeSchema = z.object({
  closedAt: z.string().datetime(),
  direction: directionSchema,
  execution: executionInputSchema.nullable(),
  instrumentId: instrumentIdSchema,
  resultKind: resultKindSchema,
  resultValue: decimalSchema,
  accountId: accountIdSchema,
  riskUsd: decimalSchema.optional(),
});

export const cashMovementSchema = z.object({
  accountId: accountIdSchema,
  amountUsd: nonNegativeDecimalSchema.refine((value) => value !== '0', {
    message: 'Cash movement amount must be positive.',
  }),
  occurredAt: z.string().datetime(),
  kind: z.enum(['deposit', 'withdrawal']),
});
export const updateCashMovementSchema = cashMovementSchema.extend({ id: z.string().min(1) });

export const updateTradeSchema = z.object({
  ...createTradeSchema.shape,
  accountId: accountIdSchema.optional(),
  direction: directionSchema,
  execution: executionSchema.nullable(),
  id: z.string().min(1),
  instrumentSymbol: z.string().min(1),
  resultSource: z.enum(['calculated', 'manual']),
  riskBindingSnapshot: riskBindingSchema.extend({ source: z.literal('vault-default') }).nullable(),
  inputResultKind: resultKindSchema.optional(),
  inputResultValue: decimalSchema.optional(),
  netResultUsd: decimalSchema.optional(),
  account: z
    .object({
      accountId: accountIdSchema,
      accountName: z.string().min(1),
      balanceBeforeUsd: decimalSchema,
      balanceImpactUsd: decimalSchema.nullable(),
      conversionBalanceUsd: decimalSchema.nullable().optional(),
      conversion: z
        .enum(['cash', 'percent-of-balance', 'r-cash-risk', 'r-percent-risk'])
        .nullable(),
      initialRiskUsd: decimalSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const neutralRangeSchema = z.object({ lower: decimalSchema, upper: decimalSchema });
export const tradePreferencesSchema = z.object({
  neutralCostSettings: z.object({
    includeCommission: z.boolean(),
    includeSpread: z.boolean(),
  }),
  neutralRanges: z.object({
    cash: neutralRangeSchema.nullable(),
    percent: neutralRangeSchema.nullable(),
    r: neutralRangeSchema.nullable(),
  }),
  riskBinding: riskBindingSchema.nullable(),
  riskPromptDismissed: z.boolean(),
});
export const updateTradePreferencesSchema = z.object({
  preferences: tradePreferencesSchema,
  rebindHistorical: z.boolean(),
});
export const instrumentProfileSchema = z.object({
  instrumentId: z.string().min(1),
  tickSize: decimalSchema,
  tickValueUsdPerLot: decimalSchema,
  updatedAt: z.string().datetime(),
});
export const summaryPreferencesSchema = z.object({
  filters: z
    .object({
      closedFrom: z.string().datetime().nullable(),
      closedTo: z.string().datetime().nullable(),
      instrumentIds: z.array(z.string().min(1)).nullable(),
      resultKinds: z.array(resultKindSchema).nullable(),
      accountIds: z.array(accountIdSchema).nullable().optional(),
      includeUnassigned: z.boolean().optional(),
    })
    .nullable(),
  metric: resultKindSchema,
  period: z.enum([
    'all',
    'current-day',
    'current-month',
    'current-quarter',
    'current-week',
    'current-year',
  ]),
});
