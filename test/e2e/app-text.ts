/**
 * Named English copy used by Electron E2E locators. The strings mirror the
 * English dictionary in `apps/desktop/src/renderer/i18n.ts`; when the
 * dictionary changes, this fixture must change with it.
 */
export const APP_TEXT = {
  account: {
    onboardingCreate: 'Create account',
    onboardingTitle: 'Create an account',
  },
  action: {
    add: 'Add',
    apply: 'Apply',
    cancel: 'Cancel',
    edit: 'Edit',
    save: 'Save',
    redo: 'Redo',
    undo: 'Undo',
  },
  field: {
    account: 'Account',
    accountOpening: 'Opening balance',
    asset: 'Asset',
    identifier: 'Identifier',
    result: 'Result',
  },
  journal: { empty: 'No trades recorded yet.' },
  navigation: {
    catalog: 'Accounts, assets & tags',
    settings: 'Settings',
    statistics: 'Statistics',
    trades: 'Trades',
  },
  onboarding: {
    create: 'Create vault',
    title: 'Your offline trading journal',
  },
  settings: {
    vaultChange: 'Change vault',
    backup: 'Create backup',
    backupSuccess: 'Backup created and verified.',
    restore: 'Restore to new folder',
    restoreSuccess: 'Restored vault is ready. Open it using Change vault.',
  },
  table: {
    layout: 'Table view',
    filterIdentifier: 'Filter identifier and notes',
    scrollRegion: 'Scrollable table',
    selectRow: 'Select trade',
  },
  trade: {
    entryNote: 'Entry note',
    reviewNote: 'Post-trade review',
    reviewStatus: 'Review status',
    reviewReviewed: 'Reviewed',
    withDetails: 'With details',
  },
} as const;
