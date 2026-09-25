import { TRANSLATION_KEYS } from '../../i18n-keys';

const COLUMN_LABEL_KEYS = {
  account: TRANSLATION_KEYS.fieldAccount,
  asset: TRANSLATION_KEYS.fieldAsset,
  balance: TRANSLATION_KEYS.fieldAccountBalance,
  category: TRANSLATION_KEYS.fieldCategory,
  closedAt: TRANSLATION_KEYS.fieldDate,
  closedAtTime: TRANSLATION_KEYS.fieldDateTime,
  direction: TRANSLATION_KEYS.fieldType,
  id: TRANSLATION_KEYS.fieldIdentifier,
  name: TRANSLATION_KEYS.fieldAccount,
  opening: TRANSLATION_KEYS.fieldAccountOpening,
  result: TRANSLATION_KEYS.fieldResult,
  resultKind: TRANSLATION_KEYS.fieldUnit,
  status: TRANSLATION_KEYS.fieldStatus,
  symbol: TRANSLATION_KEYS.fieldAsset,
  tickSize: TRANSLATION_KEYS.fieldTickSize,
  tickValue: TRANSLATION_KEYS.fieldTickValue,
} as const;

export const getTableColumnTranslationKey = (columnId: string): string | undefined =>
  COLUMN_LABEL_KEYS[columnId as keyof typeof COLUMN_LABEL_KEYS];
