import { useEffect, useState, type ReactElement } from 'react';

interface AppInfo {
  readonly name: string;
  readonly platform: string;
  readonly version: string;
}

interface WelcomePanelProps {
  readonly appInfo: AppInfo | null;
}

export const WelcomePanel = ({ appInfo }: WelcomePanelProps): ReactElement => (
  <main className="app-shell">
    <section className="welcome-card" aria-labelledby="app-title">
      <p className="eyebrow">FOUNDATION</p>
      <h1 id="app-title">TJournal</h1>
      <p className="description">Локальный журнал сделок. Базовый шаблон приложения запущен.</p>
      <dl className="app-details">
        <div>
          <dt>Версия</dt>
          <dd>{appInfo?.version ?? 'Загрузка…'}</dd>
        </div>
        <div>
          <dt>Платформа</dt>
          <dd>{appInfo?.platform ?? 'Загрузка…'}</dd>
        </div>
      </dl>
    </section>
  </main>
);

export const App = (): ReactElement => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void window.tjournal.app.getInfo().then(setAppInfo);
  }, []);

  return <WelcomePanel appInfo={appInfo} />;
};
