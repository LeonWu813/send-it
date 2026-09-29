/**
 * Tests for StatsPanel component (MOD-008).
 *
 * Tests behaviour — not implementation.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// Initialize i18n before component renders
import '../../../lib/i18n';
import { ThemeProvider } from '../../../lib/theme';
import StatsPanel from '../components/StatsPanel';
import type { ProfileStats } from '../types';
import { GRADE_ORDER } from '../types';

// ── Test wrapper ──────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ── Mock stats builders ────────────────────────────────────────────────────────

function buildStats(overrides: Partial<ProfileStats> = {}): ProfileStats {
  return {
    total_sends: 10,
    accumulated_days: 3,
    highest_grade: 'V5',
    sends_by_grade: GRADE_ORDER.map((g) => ({ grade: g, count: 0 })),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('StatsPanel', () => {
  it('renders total sends value', () => {
    const stats = buildStats({ total_sends: 42 });
    const { getByText } = render(<StatsPanel stats={stats} />, { wrapper: Wrapper });

    expect(getByText('42')).toBeTruthy();
  });

  it('renders accumulated days value', () => {
    const stats = buildStats({ accumulated_days: 7 });
    const { getByText } = render(<StatsPanel stats={stats} />, { wrapper: Wrapper });

    expect(getByText('7')).toBeTruthy();
  });

  it('renders highest grade value', () => {
    const stats = buildStats({ highest_grade: 'V8' });
    const { getAllByText } = render(<StatsPanel stats={stats} />, { wrapper: Wrapper });

    // 'V8' appears in the summary row AND in the bar chart grade labels
    expect(getAllByText('V8').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "—" when highest_grade is null', () => {
    const stats = buildStats({ highest_grade: null });
    const { getAllByText } = render(<StatsPanel stats={stats} />, { wrapper: Wrapper });

    // The i18n key profileHistory.stats.noGrade = "—"
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a bar row only for grades with count > 0', () => {
    // VB gets count=0 (index 0), all others get count=index (> 0).
    const sends_by_grade = GRADE_ORDER.map((g, i) => ({ grade: g, count: i }));
    const stats = buildStats({ sends_by_grade });
    const { getAllByText, queryByText } = render(<StatsPanel stats={stats} />, { wrapper: Wrapper });

    // Grades with count > 0 should appear in the chart.
    for (const grade of GRADE_ORDER.slice(1)) {
      expect(getAllByText(grade).length).toBeGreaterThanOrEqual(1);
    }

    // VB (count = 0) should NOT appear in the chart.
    expect(queryByText('VB')).toBeNull();
  });

  it('renders a zero-send state without crashing (all counts 0)', () => {
    const stats = buildStats({
      total_sends: 0,
      accumulated_days: 0,
      highest_grade: null,
      sends_by_grade: GRADE_ORDER.map((g) => ({ grade: g, count: 0 })),
    });
    expect(() =>
      render(<StatsPanel stats={stats} />, { wrapper: Wrapper }),
    ).not.toThrow();
  });
});
