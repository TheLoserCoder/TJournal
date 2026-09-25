import {
  MAX_TAGS_PER_TRADE,
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  isTagColorId,
  type TagColorId,
} from '@tjournal/tag';
import { z } from 'zod';

const areUnique = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;
const tagColorSchema = z.custom<TagColorId>((value) => isTagColorId(value));

export const tagIdSchema = z.string().min(1);

export const tagIdsSchema = z
  .array(tagIdSchema)
  .max(MAX_TAGS_PER_TRADE)
  .refine(areUnique, { message: 'Duplicate tag assignment.' });

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
  description: z.string().max(TAG_DESCRIPTION_MAX_LENGTH).optional(),
  color: tagColorSchema.optional(),
});

export const updateTagSchema = z.object({
  color: tagColorSchema,
  description: z.string().max(TAG_DESCRIPTION_MAX_LENGTH),
  id: tagIdSchema,
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
});
