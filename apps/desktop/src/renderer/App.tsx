import { useMemo, type ReactElement } from 'react';

import './i18n';
import { JournalView } from './features/journal/journal-view';
import { useJournalPresenter } from './features/journal/use-journal-presenter';
import { createElectronRendererGateway } from './gateway/electron-renderer-gateway';

export const App = (): ReactElement => {
  const gateway = useMemo(createElectronRendererGateway, []);
  return <JournalView presenter={useJournalPresenter(gateway)} />;
};
