/**
 * Browser-safe subset of the tag domain: colour palette and name limits only.
 * It deliberately excludes the use cases so the renderer never bundles
 * `node:crypto`.
 */
export {
  TAG_COLOR_IDS,
  TAG_COLOR_PALETTE,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  isTagColorId,
  type TagColorId,
} from './tag';
export { suggestTagColor, tagColorDistance } from './tag-color';
