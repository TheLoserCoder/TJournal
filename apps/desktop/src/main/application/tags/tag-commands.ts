import type {
  CreateTagInput,
  CreateTagUseCase,
  DeletedTagSnapshot,
  DeleteTagsUseCase,
  GetTagByIdUseCase,
  RestoreTagsUseCase,
  Tag,
  UpdateTagInput,
  UpdateTagUseCase,
} from '@tjournal/tag';

import { DATA_RESOURCES } from '../../../shared/desktop-api';
import type { CommandHistory } from '../command-history';
import type { CommandOutcome } from '../command-outcome';

const TAG_RESOURCES = [DATA_RESOURCES.history, DATA_RESOURCES.tags] as const;
const TAG_LINK_RESOURCES = [...TAG_RESOURCES, DATA_RESOURCES.tradeTags] as const;

/**
 * Undo/Redo orchestration for the tag catalogue. Owns snapshot capture and the
 * inverse operation; the IPC layer only parses input and publishes changes.
 */
export class TagCommands {
  public constructor(
    private readonly history: CommandHistory,
    private readonly createTagUseCase: Pick<CreateTagUseCase, 'execute'>,
    private readonly updateTagUseCase: Pick<UpdateTagUseCase, 'execute'>,
    private readonly getTagByIdUseCase: Pick<GetTagByIdUseCase, 'execute'>,
    private readonly deleteTagsUseCase: Pick<DeleteTagsUseCase, 'execute'>,
    private readonly restoreTagsUseCase: Pick<RestoreTagsUseCase, 'execute'>,
  ) {}

  public create(input: CreateTagInput): CommandOutcome<Tag> {
    let created: Tag | null = null;
    const value = this.history.execute({
      execute: () => {
        // Reuse the id on Redo so a restored tag keeps its trade assignments.
        created = this.createTagUseCase.execute(input, created?.id);
        return created;
      },
      label: 'tag.create',
      undo: () => {
        if (created !== null) this.deleteTagsUseCase.execute([created.id]);
      },
    });
    return { changedResources: TAG_LINK_RESOURCES, value };
  }

  public update(input: UpdateTagInput): CommandOutcome<Tag> {
    const previous = this.getTagByIdUseCase.execute(input.id);
    if (previous === null) throw new Error('Tag not found.');
    const value = this.history.execute({
      execute: () => this.updateTagUseCase.execute(input),
      label: 'tag.update',
      undo: () => {
        this.updateTagUseCase.execute(previous);
      },
    });
    return { changedResources: TAG_RESOURCES, value };
  }

  public deleteMany(ids: readonly string[]): CommandOutcome<readonly Tag[]> {
    let snapshots: readonly DeletedTagSnapshot[] = [];
    const value = this.history.execute({
      execute: () => {
        snapshots = this.deleteTagsUseCase.execute(ids);
        return snapshots.map((snapshot) => snapshot.tag);
      },
      label: 'tag.delete-many',
      undo: () => {
        this.restoreTagsUseCase.execute(snapshots);
      },
    });
    return { changedResources: TAG_LINK_RESOURCES, value };
  }
}
