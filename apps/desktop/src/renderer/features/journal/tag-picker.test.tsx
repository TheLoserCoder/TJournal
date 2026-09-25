import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TagDto } from '../../../shared/desktop-api';
import { i18n } from '../../i18n';
import { TagPicker } from './tag-picker';

const TEST_TAGS: readonly TagDto[] = [
  {
    color: 'indigo',
    createdAt: '2026-09-13T12:00:00.000Z',
    description: 'Trend continuation',
    id: 'tag-breakout',
    name: 'Breakout',
    updatedAt: '2026-09-13T12:00:00.000Z',
  },
  {
    color: 'rose',
    createdAt: '2026-09-13T12:00:00.000Z',
    description: '',
    id: 'tag-news',
    name: 'News',
    updatedAt: '2026-09-13T12:00:00.000Z',
  },
];

const renderPicker = (
  overrides: Partial<Parameters<typeof TagPicker>[0]> = {},
): {
  readonly onCreateTag: ReturnType<typeof vi.fn>;
  readonly onSelectedIdsChange: ReturnType<typeof vi.fn>;
} => {
  const onCreateTag = vi.fn().mockResolvedValue(undefined);
  const onSelectedIdsChange = vi.fn();
  const picker = (
    <I18nextProvider i18n={i18n}>
      <TagPicker
        createLabel={(name) => `Create ${name}`}
        emptyMessage="No tags"
        hasSelection={false}
        label="Tags"
        onCreateTag={onCreateTag}
        onSelectedIdsChange={onSelectedIdsChange}
        options={TEST_TAGS}
        placeholder="Select tags"
        searchPlaceholder="Search"
        selectedIds={[]}
        {...overrides}
      />
    </I18nextProvider>
  ) as ReactElement;
  render(picker);
  return { onCreateTag, onSelectedIdsChange };
};

describe('TagPicker', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps a fixed caption and signals selection through the active state only', () => {
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <TagPicker
          createLabel={(name) => `Create ${name}`}
          emptyMessage="No tags"
          hasSelection={false}
          label="Tags"
          onCreateTag={vi.fn().mockResolvedValue(undefined)}
          onSelectedIdsChange={vi.fn()}
          options={TEST_TAGS}
          placeholder="Select tags"
          searchPlaceholder="Search"
          selectedIds={[]}
        />
      </I18nextProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Tags' });
    expect(trigger).toHaveTextContent('Select tags');
    expect(trigger).not.toHaveClass('is-active');

    rerender(
      <I18nextProvider i18n={i18n}>
        <TagPicker
          createLabel={(name) => `Create ${name}`}
          emptyMessage="No tags"
          hasSelection
          label="Tags"
          onCreateTag={vi.fn().mockResolvedValue(undefined)}
          onSelectedIdsChange={vi.fn()}
          options={TEST_TAGS}
          placeholder="Select tags"
          searchPlaceholder="Search"
          selectedIds={['tag-breakout']}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: 'Tags' })).toHaveTextContent('Select tags');
    expect(screen.getByRole('button', { name: 'Tags' })).toHaveClass('is-active');
  });

  it('lists chips without comments and toggles selection', () => {
    const { onSelectedIdsChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }));

    expect(screen.queryByText('Trend continuation')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Breakout' }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(['tag-breakout']);
  });

  it('offers inline creation for a name without an exact match', () => {
    const { onCreateTag } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }));
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'Scalp' } });

    const create = screen.getByRole('button', { name: 'Create Scalp' });
    fireEvent.click(create);
    expect(onCreateTag).toHaveBeenCalledWith('Scalp');
  });

  it('hides the creation row when the name already exists', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }));
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'breakout' } });

    expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Breakout' })).toBeDefined();
  });
});
