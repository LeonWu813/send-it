import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../lib/theme';
import { ButtonGroup } from '../ui/ButtonGroup';

function layout(width: number): { nativeEvent: { layout: { width: number; height: number; x: number; y: number } } } {
  return { nativeEvent: { layout: { width, height: 20, x: 0, y: 0 } } };
}

function directionOf(root: ReturnType<typeof render>): string | undefined {
  const row = root.UNSAFE_root.findAll(
    (n: { type: unknown; props: Record<string, any> }) => n.type === 'View' && typeof n.props.style === 'object' && StyleSheet.flatten(n.props.style)?.gap === 8,
  )[0];
  return StyleSheet.flatten(row.props.style).flexDirection as string | undefined;
}

function setup(widths: [number, number], container: number, fontScale = 1): ReturnType<typeof render> {
  const root = render(
    <ThemeProvider>
      <ButtonGroup
        fontScale={fontScale}
        buttons={[{ label: 'A', onPress: jest.fn() }, { label: 'B', onPress: jest.fn() }]}
      />
    </ThemeProvider>,
  );
  const views = root.UNSAFE_root.findAll((n: { type: unknown; props: Record<string, any> }) => n.type === 'View' && typeof n.props.onLayout === 'function');
  act(() => {
    views[0].props.onLayout(layout(container));
    views[1].props.onLayout(layout(widths[0]));
    views[2].props.onLayout(layout(widths[1]));
  });
  return root;
}

describe('ButtonGroup', () => {
  it('sits side by side when both labels fit', () => {
    expect(directionOf(setup([40, 60], 361))).toBe('row');
  });

  it('stacks when a label does not fit in half the width', () => {
    expect(directionOf(setup([40, 200], 361))).toBe('column');
  });

  it('always stacks at fontScale >= 1.35', () => {
    expect(directionOf(setup([40, 60], 361, 1.35))).toBe('column');
  });

  it('renders both buttons', () => {
    setup([40, 60], 361);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.press(screen.getAllByRole('button')[0]);
  });
});
