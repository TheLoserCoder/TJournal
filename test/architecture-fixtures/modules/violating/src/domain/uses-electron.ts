// Intentional violation: a domain module must not import Electron.
import { app } from 'electron';

export const name = app.getName();
