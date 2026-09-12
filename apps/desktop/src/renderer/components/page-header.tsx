import type { ReactElement } from 'react';
export const PageHeader = ({ title }: { readonly title: string }): ReactElement => (
  <header className="page-header">
    <h1>{title}</h1>
  </header>
);
