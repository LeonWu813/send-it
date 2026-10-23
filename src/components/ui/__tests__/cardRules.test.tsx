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

  it('ghost retry glyph sits on the padding line (-14 against the button padding)', () => {
    wrap(<InlineError variant="block" on="elevated" message="Failed" actionLabel="Retry" onAction={() => {}} />);
    let n: any = screen.getByLabelText('Retry').parent;
    const margins: unknown[] = [];
    while (n) {
      const st = StyleSheet.flatten(n.props?.style);
      margins.push(st?.marginRight, st?.marginLeft); // marginRight inline, marginLeft when stacked (font scale >= 1.6)
      n = n.parent;
    }
    expect(margins).toContain(-14);
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
