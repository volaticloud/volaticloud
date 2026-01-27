import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle, useRawDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = 'Initial Title';
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('should set document title with app name suffix', () => {
    renderHook(() => useDocumentTitle('Dashboard'));

    expect(document.title).toBe('Dashboard | VolatiCloud');
  });

  it('should show only app name when title is empty', () => {
    renderHook(() => useDocumentTitle(''));

    expect(document.title).toBe('VolatiCloud');
  });

  it('should restore previous title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Test Page'));

    expect(document.title).toBe('Test Page | VolatiCloud');

    unmount();

    expect(document.title).toBe('Initial Title');
  });

  it('should update title when title prop changes', () => {
    const { rerender } = renderHook(
      ({ title }) => useDocumentTitle(title),
      { initialProps: { title: 'First Title' } }
    );

    expect(document.title).toBe('First Title | VolatiCloud');

    rerender({ title: 'Second Title' });

    expect(document.title).toBe('Second Title | VolatiCloud');
  });

  it('should update title when dependencies change', () => {
    let dynamicValue = 'Initial';

    const { rerender } = renderHook(
      ({ value }) => useDocumentTitle(`Page - ${value}`, [value]),
      { initialProps: { value: dynamicValue } }
    );

    expect(document.title).toBe('Page - Initial | VolatiCloud');

    dynamicValue = 'Updated';
    rerender({ value: dynamicValue });

    expect(document.title).toBe('Page - Updated | VolatiCloud');
  });
});

describe('useRawDocumentTitle', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = 'Initial Title';
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('should set document title without suffix', () => {
    renderHook(() => useRawDocumentTitle('Custom Title'));

    expect(document.title).toBe('Custom Title');
  });

  it('should restore previous title on unmount', () => {
    const { unmount } = renderHook(() => useRawDocumentTitle('Raw Title'));

    expect(document.title).toBe('Raw Title');

    unmount();

    expect(document.title).toBe('Initial Title');
  });

  it('should update title when title prop changes', () => {
    const { rerender } = renderHook(
      ({ title }) => useRawDocumentTitle(title),
      { initialProps: { title: 'First' } }
    );

    expect(document.title).toBe('First');

    rerender({ title: 'Second' });

    expect(document.title).toBe('Second');
  });
});
