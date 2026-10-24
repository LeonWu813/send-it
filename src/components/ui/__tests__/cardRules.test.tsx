/** Flat-alignment audit §6: C1 padding, C3 gaps, C4 trailing ghost action. */
import '../../../lib/i18n';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../../../lib/theme';
import { InlineError } from '../InlineError';
import { ProgressBar, UploadProgressCard } from '../ProgressBar';

/** Nearest ancestor-or-self whose flattened style has `key`. */
function up(el: { parent: any; props: any } | null, key: string): Record<string, any> {
  let n = el;
  while (n) {
    const st = StyleSheet.flatten(n.props?.style);
    if (st && st[key] !== undefined) return st;
    n = n.parent;
  }
  throw new Error(`no ancestor with ${key}`);
}

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('InlineError padding (C1)', () => {
  it('block in sheet is a Container: 16 on all sides', () => {
    wrap(<InlineError variant="block" on="elevated" title="T" message="Message body" />);
    const style = up(screen.getByText('Message body'), 'paddingVertical');
    expect(style).toMatchObject({ paddingVertical: 16, paddingHorizontal: 16 });
  });

  it('notice is a row band: 12 vertical, 16 horizontal', () => {
    wrap(<InlineError variant="notice" message="Heads up" />);
    const style = up(screen.getByText('Heads up'), 'paddingVertical');
    expect(style).toMatchObject({ paddingVertical: 12, paddingHorizontal: 16 });
  });

  it('callout action is a text button: no padding to cancel (no negative margin) and no leading icon', () => {
    const { toJSON } = wrap(<InlineError variant="block" on="elevated" message="Failed" actionLabel="Retry" onAction={() => {}} />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('"marginRight":-14');
    expect(json).not.toContain('"marginLeft":-14');
    expect(json).not.toContain('refresh');
    const btn = screen.getByLabelText('Retry');
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({ alignSelf: 'flex-start' });
  });
});

describe('UploadProgressCard rhythm (A1, C3)', () => {
  it('thumbnail to text is 12 and title to meta is 4', () => {
    wrap(<UploadProgressCard title="Uploading" routeName="Route" percent={40} progressLabel="Uploading" />);
    const col = up(screen.getByText('Uploading'), 'marginLeft');
    expect(col.marginLeft).toBe(12);
    const meta = up(screen.getByText('Route'), 'marginTop');
    expect(meta.marginTop).toBe(4);
  });
});

it('ProgressBar still exports', () => {
  expect(ProgressBar).toBeDefined();
});
