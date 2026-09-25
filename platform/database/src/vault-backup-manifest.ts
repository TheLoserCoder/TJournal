import { z } from 'zod';

export const BACKUP_FORMAT_VERSION = 1;
export const AUTOMATIC_BACKUP_RETENTION = 20;

export const backupManifestSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  id: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}$/),
  kind: z.enum(['automatic', 'manual']),
  createdAt: z.iso.datetime(),
  sourceVaultId: z.uuid(),
  appVersion: z.string().min(1),
  migrationIds: z.array(z.string().min(1)),
  databaseSha256: z.string().regex(/^[0-9a-f]{64}$/),
  databaseBytes: z.number().int().nonnegative(),
  attachmentsIncluded: z.literal(false),
});

export type VaultBackupManifest = z.infer<typeof backupManifestSchema>;
