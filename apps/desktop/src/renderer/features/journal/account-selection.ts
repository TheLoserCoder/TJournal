export interface AccountSelectionOption {
  readonly archivedAt: string | null;
  readonly id: string;
}

/**
 * Resolves the account displayed by the controlled quick-entry select.
 * The current selection wins during ordinary data refreshes; the remembered
 * value is only a fallback for initial restoration or a missing account.
 */
export const resolveAccountSelection = (
  accounts: readonly AccountSelectionOption[],
  currentAccountId: string | null,
  rememberedAccountId: string | null,
): string | null => {
  const activeAccounts = accounts.filter((account) => account.archivedAt === null);
  if (activeAccounts.length === 0) return null;
  if (activeAccounts.some((account) => account.id === currentAccountId)) return currentAccountId;
  if (activeAccounts.some((account) => account.id === rememberedAccountId)) {
    return rememberedAccountId;
  }
  return activeAccounts[0]?.id ?? null;
};
