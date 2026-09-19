import {
  DATA_RESOURCES,
  type CommittedDataChangeDto,
  type DataResource,
} from '../shared/desktop-api';

const DATA_RESOURCE_VALUES = new Set<DataResource>(Object.values(DATA_RESOURCES));

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isRevisionMap = (value: unknown): value is CommittedDataChangeDto['revisions'] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (revision) => typeof revision === 'number' && Number.isInteger(revision) && revision >= 0,
  );
};

export const isCommittedDataChange = (value: unknown): value is CommittedDataChangeDto => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.changeId) &&
    isNonEmptyString(candidate.vaultGeneration) &&
    Array.isArray(candidate.resources) &&
    candidate.resources.every(
      (resource): resource is DataResource =>
        typeof resource === 'string' && DATA_RESOURCE_VALUES.has(resource as DataResource),
    ) &&
    isRevisionMap(candidate.revisions)
  );
};
