import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { ICON } from '../../lib/icons';
import { useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { InlineError } from './InlineError';
import { Spinner } from './ProgressBar';

export type TextFieldVariant = 'singleLine' | 'multiline' | 'search';

export interface TextFieldProps
  extends Pick<
    TextInputProps,
    | 'keyboardType'
    | 'autoCapitalize'
    | 'autoComplete'
    | 'autoCorrect'
    | 'textContentType'
    | 'returnKeyType'
    | 'onSubmitEditing'
    | 'onFocus'
    | 'onBlur'
    | 'autoFocus'
    | 'maxLength'
  > {
  /** singleLine: min 48. multiline: min 96, grows to 5 lines then scrolls, Return = newline. search: min 44, search glyph, no label. */
  variant?: TextFieldVariant;
  /** Field label (footnote 600, textSecondary). Required except for `search` (use accessibilityLabel). */
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Example only, never a repeat of the label. */
  placeholder?: string;
  /** Translated validation message: red 1.5pt outline + InlineError `field` (icon + text). Input is kept. */
  error?: string;
  /** Helper text under the field (also explains why a field is read-only / disabled). */
  helper?: string;
  /** Show "12/280" under the field (needs maxLength). */
  showCount?: boolean;
  /** Visible but not editable (e.g. grade derived from the route): textSecondary value + lock glyph. VoiceOver: "label, value, read only". */
  readOnly?: boolean;
  /** Only when the value does not matter. Prefer `readOnly`. */
  disabled?: boolean;
  /** Password field with a show/hide eye toggle (label stays "Show password"; state = selected). */
  secureTextEntry?: boolean;
  /** search: show a small spinner at the end while searching. */
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * `surfaceAlt` field, radius md. Outline: 1pt `outline` (3:1) -> focused 1.5pt `primary` -> error 1.5pt
 * `error`; read-only / disabled 1pt `border`. Padding drops 0.5 when the outline thickens so nothing
 * jumps. The outline switches instantly (no animation). Text is `body` 17 so iOS never zooms in.
 * Tapping anywhere (label included) focuses. Keep the user's input on error.
 */
export function TextField({
  variant = 'singleLine',
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  showCount,
  readOnly = false,
  disabled = false,
  secureTextEntry = false,
  loading = false,
  maxLength,
  accessibilityLabel,
  accessibilityHint,
  ...inputProps
}: TextFieldProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const c = theme.colors;
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const multiline = variant === 'multiline';
  const search = variant === 'search';
  const locked = readOnly || disabled;
  const { thin, emphasis } = theme.stroke;
  const borderW = error || (focused && !locked) ? emphasis : thin;
  const borderColor = error ? c.error : locked ? c.border : focused ? c.primary : c.outline;
  // The outline grows 1 -> 1.5, so the padding shrinks by 0.5: the outer size never changes.
  const pad = (base: number): number => base - (borderW - thin);
  const minHeight = multiline ? 96 : search ? theme.layout.minTouchTarget : theme.componentSize.textFieldMinHeight;
  const maxLines = theme.typeScale.body.lineHeight * 5 + 2 * theme.spacing.smd;
  const textColor = disabled ? c.textDisabled : readOnly ? c.textSecondary : c.textPrimary;
  const baseLabel = label ?? accessibilityLabel ?? '';
  const a11yLabel = readOnly
    ? t('ui.readOnly', { label: baseLabel, value })
    : error
      ? t('ui.fieldError', { label: baseLabel, error })
      : baseLabel;
  const showClear = search && value.length > 0 && !locked;

  return (
    <View>
      {label && !search ? (
        <Pressable accessible={false} onPress={() => input.current?.focus()} style={{ marginBottom: theme.spacing.xs }}>
          <AppText variant="footnote" weight="600" color="textSecondary">
            {label}
          </AppText>
        </Pressable>
      ) : null}
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        style={{
          minHeight,
          ...(multiline ? { maxHeight: maxLines } : null),
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: c.surfaceAlt,
          borderRadius: theme.borderRadius.md,
          borderWidth: borderW,
          borderColor,
          paddingLeft: pad(theme.spacing.smd),
          paddingRight: showClear || (secureTextEntry && !locked) ? 0 : pad(theme.spacing.smd),
          paddingVertical: multiline ? pad(theme.spacing.smd) : 0,
        }}
      >
        {search ? (
          <Ionicons name={ICON.search.outline} size={theme.iconSize.md} color={c.textSecondary} style={{ marginRight: theme.spacing.sm }} />
        ) : null}
        <TextInput
          ref={input}
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={c.textPlaceholder}
          selectionColor={c.primary}
          editable={!locked}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          accessibilityLabel={a11yLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled }}
          maxFontSizeMultiplier={theme.typeScale.body.maxFontSizeMultiplier}
          style={{
            flex: 1,
            color: textColor,
            fontSize: theme.typeScale.body.fontSize,
            // single-line inputs skip lineHeight: iOS pushes the text down when lineHeight is large
            ...(multiline ? { lineHeight: theme.typeScale.body.lineHeight, textAlignVertical: 'top' as const } : null),
            paddingVertical: 0,
            minHeight: multiline ? 0 : undefined,
            letterSpacing: 0,
          }}
        />
        {loading && search ? (
          <View style={{ marginLeft: theme.spacing.sm }}>
            <Spinner />
          </View>
        ) : null}
        {readOnly ? (
          <Ionicons name={ICON.locked.outline} size={theme.iconSize.sm} color={c.textSecondary} style={{ marginLeft: theme.spacing.sm }} accessibilityElementsHidden />
        ) : null}
        {secureTextEntry && !locked ? (
          <IconButton
            variant="toggle"
            on="background"
            name={ICON.passwordVisibility.outline}
            nameOn={ICON.passwordVisibility.on}
            size={theme.iconSize.md}
            color="textSecondary"
            colorOn="textSecondary"
            selected={revealed}
            accessibilityLabel={t('ui.showPassword')}
            onPress={() => setRevealed((r) => !r)}
          />
        ) : null}
        {showClear ? (
          <IconButton
            on="background"
            name={ICON.clear.filled}
            size={theme.iconSize.md}
            color="textSecondary"
            accessibilityLabel={t('ui.clearText')}
            onPress={() => {
              onChangeText('');
              input.current?.focus();
            }}
          />
        ) : null}
      </Pressable>
      {error || helper || (showCount && maxLength) ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: theme.spacing.xs }}>
          <View style={{ flex: 1 }}>
            {error ? (
              <InlineError variant="field" message={error} />
            ) : helper ? (
              <AppText variant="footnote" color="textSecondary">
                {helper}
              </AppText>
            ) : null}
          </View>
          {showCount && maxLength ? (
            <AppText variant="caption1" numeric color="textSecondary" style={{ marginLeft: theme.spacing.sm }}>
              {`${value.length}/${maxLength}`}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
