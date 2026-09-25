export const TAG_COLOR_IDS = {
  amber: 'amber',
  blue: 'blue',
  cyan: 'cyan',
  indigo: 'indigo',
  olive: 'olive',
  orange: 'orange',
  rose: 'rose',
  slate: 'slate',
  teal: 'teal',
  violet: 'violet',
} as const;
export type TagColorId = (typeof TAG_COLOR_IDS)[keyof typeof TAG_COLOR_IDS];

/**
 * Palette order is part of the colour rule: it is the deterministic tie-break of
 * the suggestion algorithm and the layout of the editor swatches.
 */
export const TAG_COLOR_PALETTE: readonly TagColorId[] = [
  TAG_COLOR_IDS.indigo,
  TAG_COLOR_IDS.blue,
  TAG_COLOR_IDS.cyan,
  TAG_COLOR_IDS.teal,
  TAG_COLOR_IDS.olive,
  TAG_COLOR_IDS.amber,
  TAG_COLOR_IDS.orange,
  TAG_COLOR_IDS.rose,
  TAG_COLOR_IDS.violet,
  TAG_COLOR_IDS.slate,
];

export const TAG_NAME_MAX_LENGTH = 64;
export const TAG_DESCRIPTION_MAX_LENGTH = 500;
export const MAX_TAGS_PER_TRADE = 32;

export interface Tag {
  readonly color: TagColorId;
  readonly createdAt: string;
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface CreateTagInput {
  readonly color?: TagColorId;
  readonly description?: string;
  readonly name: string;
}

export interface UpdateTagInput {
  readonly color: TagColorId;
  readonly description: string;
  readonly id: string;
  readonly name: string;
}

export const TAG_VALIDATION_CODES = {
  colorInvalid: 'tag-color-invalid',
  descriptionTooLong: 'tag-description-too-long',
  nameDuplicate: 'tag-name-duplicate',
  nameRequired: 'tag-name-required',
  nameTooLong: 'tag-name-too-long',
  tagNotFound: 'tag-not-found',
} as const;
export type TagValidationIssueCode =
  (typeof TAG_VALIDATION_CODES)[keyof typeof TAG_VALIDATION_CODES];

export interface TagValidationIssue {
  readonly code: TagValidationIssueCode;
  readonly path: string;
}

export class TagValidationError extends Error {
  public readonly issues: readonly TagValidationIssue[];

  public constructor(issues: readonly TagValidationIssue[]) {
    super(issues.map((issue) => issue.code).join(', '));
    this.name = 'TagValidationError';
    this.issues = issues;
  }
}

export const isTagColorId = (value: unknown): value is TagColorId =>
  typeof value === 'string' && (TAG_COLOR_PALETTE as readonly string[]).includes(value);

export const normalizeTagName = (name: string): string => {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new TagValidationError([{ code: TAG_VALIDATION_CODES.nameRequired, path: 'name' }]);
  }
  if (normalized.length > TAG_NAME_MAX_LENGTH) {
    throw new TagValidationError([{ code: TAG_VALIDATION_CODES.nameTooLong, path: 'name' }]);
  }
  return normalized;
};

/** Case- and Unicode-form-insensitive identity used for the uniqueness guarantee. */
export const normalizeTagNameKey = (name: string): string =>
  name.trim().normalize('NFKC').toLowerCase();

export const normalizeTagDescription = (description: string | undefined): string => {
  const normalized = (description ?? '').trim();
  if (normalized.length > TAG_DESCRIPTION_MAX_LENGTH) {
    throw new TagValidationError([
      { code: TAG_VALIDATION_CODES.descriptionTooLong, path: 'description' },
    ]);
  }
  return normalized;
};

export const requireTagColor = (color: unknown): TagColorId => {
  if (!isTagColorId(color)) {
    throw new TagValidationError([{ code: TAG_VALIDATION_CODES.colorInvalid, path: 'color' }]);
  }
  return color;
};
