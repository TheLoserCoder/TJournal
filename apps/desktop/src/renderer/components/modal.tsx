import type { PropsWithChildren, ReactElement } from 'react';

export const Modal = ({
  children,
  title,
}: PropsWithChildren<{ readonly title: string }>): ReactElement => (
  <div aria-modal="true" className="modal-backdrop" role="dialog">
    <section className="modal-card">
      <h2>{title}</h2>
      {children}
    </section>
  </div>
);
