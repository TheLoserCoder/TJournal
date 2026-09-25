// Intentional violation: an application command must not import the history adapter.
import { UndoRedoHistory } from '../history/undo-redo-history';

export const History = UndoRedoHistory;
