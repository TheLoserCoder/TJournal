import { createContext, useContext } from 'react';

// Radix modal dialogs disable pointer events outside Content, so floating controls must portal into it.
export const DialogPortalContainerContext = createContext<HTMLElement | null>(null);

export const useDialogPortalContainer = (): HTMLElement | null =>
  useContext(DialogPortalContainerContext);
