import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import '../../../lib/i18n';
import { ThemeProvider } from '../../../lib/theme';
import AscentHistoryItem from '../components/AscentHistoryItem';
import FilterBar from '../components/FilterBar';
import { EMPTY_FILTERS } from '../types';

function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}

const item = {
  ascent_id: 'a', route_id: 'r', gym_id: 'g', gym_name: 'Rock Lab', grade: 'V4', color_tag: 'red',
  section_label: 'Cave', photo_url: null, style: 'flash' as const, attempts: 1, note: null,
  logged_at: '2026-09-20T10:30:00Z', is_private: true,
};

describe('AscentHistoryItem', () => {
  it('shows the grade on the tape, the area as title and a merged a11y label', () => {
    const { getByText, getByLabelText } = render(<AscentHistoryItem item={item} />, { wrapper: Wrapper });
    expect(getByText('V4')).toBeTruthy();
    expect(getByText('Cave')).toBeTruthy();
    expect(getByLabelText(/V4 Red \(Cave\), Rock Lab, Flash/)).toBeTruthy();
  });
});

describe('FilterBar', () => {
  it('opens the grade sheet and applies a grade', () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText } = render(
      <FilterBar filters={EMPTY_FILTERS} gyms={[]} onFiltersChange={onChange} />,
      { wrapper: Wrapper },
    );
    fireEvent.press(getByLabelText(/Filter by grade/));
    fireEvent.press(getByText('V3'));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, grade: 'V3' });
  });
});
