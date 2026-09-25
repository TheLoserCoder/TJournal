import { useMemo, type ReactElement } from 'react';

import './i18n';
import { JournalView } from './features/journal/journal-view';
import {
  useJournalPresenter,
  type JournalPresenter,
} from './features/journal/use-journal-presenter';
import { useJournalWorkspacePresenter } from './features/journal/use-journal-workspace-presenter';
import { VaultOnboardingView } from './features/vault/vault-onboarding-view';
import { createElectronRendererGateway } from './gateway/electron-renderer-gateway';

/**
 * The workspace owns every session draft (quick entry, editors, confirmations).
 * It is remounted per vault session, so an opened vault can never inherit pending
 * state from the previous one, while ordinary data revisions keep it mounted.
 */
const Workspace = ({ journal }: { readonly journal: JournalPresenter }): ReactElement => {
  const workspacePresenter = useJournalWorkspacePresenter(journal);
  return <JournalView presenter={workspacePresenter} />;
};

export const App = (): ReactElement => {
  const gateway = useMemo(createElectronRendererGateway, []);
  const journalPresenter = useJournalPresenter(gateway);

  // The vault is the outermost boundary: nothing else can be shown or persisted
  // until a vault is created or opened.
  if (!journalPresenter.vaultResolved) return <></>;
  if (journalPresenter.vaultPath === null) {
    return <VaultOnboardingView presenter={journalPresenter} />;
  }

  return (
    <Workspace
      journal={journalPresenter}
      key={`${journalPresenter.vaultPath}:${journalPresenter.vaultSessionId}`}
    />
  );
};
