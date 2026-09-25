// Intentional violation: cross-module imports must use a public entry point.
import { normalizeTagIds } from '@tjournal/trade/src/domain/trade';

export const tags = normalizeTagIds(['tag-1']);
