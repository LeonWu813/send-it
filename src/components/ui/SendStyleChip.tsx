import React from 'react';
import { useTranslation } from 'react-i18next';

import { useMotion } from '../../lib/motion';
import { SEND_GLYPH, SEND_LABEL, SendStatus } from './SendStatus';
import type { SendStatusProps, SendStyle } from './SendStatus';
import { SegmentedControl } from './SegmentedControl';
import type { PaletteKey } from '../../lib/theme';

export type { SendStyle } from './SendStatus';

/** @deprecated renamed `SendStatus` (v2.2). Kept one version as a re-export; defaults to the `tag` variant. */
export type SendStyleChipProps = SendStatusProps;
/** @deprecated use `SendStatus`. */
export const SendStyleChip = SendStatus;

export interface SendStylePickerProps {
  value?: SendStyle;
  onChange: (value: SendStyle) => void;
  disabled?: boolean;
}

const COLOR: Record<SendStyle, PaletteKey> = { top: 'sendTop', flash: 'sendFlash', attempt: 'sendAttempt' };

/**
 * Log-send selector (v2.2): a SegmentedControl `icon` variant (tap only), selected item = the style
 * colour + filled glyph (attempt stays ellipse-outline). Haptic `select`, sourceId `segmented-send-style`.
 * With no `value` nothing is highlighted (the thumb sits on the first item until a choice is made).
 */
export function SendStylePicker({ value, onChange, disabled }: SendStylePickerProps): React.JSX.Element {
  const { t } = useTranslation('common');
  useMotion();
  const order: SendStyle[] = ['top', 'flash', 'attempt'];
  return (
    <SegmentedControl<SendStyle>
      variant="icon"
      accessibilityLabel={t('ui.sendStyle.group')}
      hapticPurpose="send-style"
      disabled={disabled}
      value={value ?? 'top'}
      onChange={onChange}
      options={order.map((s) => ({
        value: s,
        label: t(SEND_LABEL[s]),
        icon: SEND_GLYPH[s].outline,
        iconSelected: SEND_GLYPH[s].filled,
        selectedColor: COLOR[s],
      }))}
    />
  );
}
