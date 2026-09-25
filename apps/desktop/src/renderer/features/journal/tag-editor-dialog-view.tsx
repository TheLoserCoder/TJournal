import {
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  type TagColorId,
} from '@tjournal/tag/palette';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { CreateTagDto, TagDto, UpdateTagDto } from '../../../shared/desktop-api';
import { Button } from '../../components/ui/button';
import { BUTTON_VARIANTS } from '../../components/ui/button.config';
import { Dialog } from '../../components/ui/dialog';
import { TextArea } from '../../components/ui/text-area';
import { TextField } from '../../components/ui/text-field';
import { TRANSLATION_KEYS } from '../../i18n-keys';
import { TagChip } from './tag-chip';
import { TagColorPicker } from './tag-color-picker';

interface TagEditorDialogProps {
  readonly onClose: () => void;
  /** `true` closes the editor; a rejected save keeps the draft visible. */
  readonly onSave: (input: CreateTagDto | UpdateTagDto) => Promise<boolean>;
  readonly open: boolean;
  readonly suggestedColor: TagColorId;
  readonly tag: TagDto | null;
}

/** Full tag editor: name, comment and an explicit palette colour. */
export const TagEditorDialogView = ({
  onClose,
  onSave,
  open,
  suggestedColor,
  tag,
}: TagEditorDialogProps): ReactElement => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<TagColorId>(suggestedColor);

  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? '');
    setDescription(tag?.description ?? '');
    setColor(tag?.color ?? suggestedColor);
  }, [open, suggestedColor, tag]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (name.trim() === '') return;
    if (tag === null) await onSave({ color, description, name });
    else await onSave({ color, description, id: tag.id, name });
  };

  return (
    <Dialog
      closeLabel={t(TRANSLATION_KEYS.actionClose)}
      contentClassName="tag-editor-dialog"
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
      title={t(tag === null ? TRANSLATION_KEYS.tagCreateTitle : TRANSLATION_KEYS.tagEditTitle)}
    >
      <form className="ui-dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="ui-field">
          <span>{t(TRANSLATION_KEYS.fieldTag)}</span>
          <TextField
            aria-label={t(TRANSLATION_KEYS.fieldTag)}
            maxLength={TAG_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.tagNamePlaceholder)}
            required
            value={name}
          />
        </label>
        <label className="ui-field">
          <span>{t(TRANSLATION_KEYS.fieldTagDescription)}</span>
          <TextArea
            aria-label={t(TRANSLATION_KEYS.fieldTagDescription)}
            maxLength={TAG_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t(TRANSLATION_KEYS.tagDescriptionPlaceholder)}
            rows={3}
            value={description}
          />
        </label>
        <fieldset className="ui-field">
          <legend>{t(TRANSLATION_KEYS.fieldTagColor)}</legend>
          <TagColorPicker onChange={setColor} value={color} />
        </fieldset>
        <div className="tag-editor-preview">
          <TagChip
            color={color}
            label={name.trim() === '' ? t(TRANSLATION_KEYS.tagNamePlaceholder) : name}
          />
        </div>
        <div className="ui-dialog-actions">
          <Button onClick={onClose} type="button" variant={BUTTON_VARIANTS.secondary}>
            {t(TRANSLATION_KEYS.actionCancel)}
          </Button>
          <Button type="submit" variant={BUTTON_VARIANTS.primary}>
            {t(TRANSLATION_KEYS.actionSave)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
