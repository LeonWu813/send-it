import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Switch, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ICON } from '../../lib/icons';
import type { IoniconName } from '../../lib/icons';
import { SPRING_REST, USE_NATIVE_DRIVER, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { PressableScale } from './PressableScale';

export type ListRowVariant = 'navigation' | 'value' | 'toggle' | 'selectable' | 'radio' | 'action' | 'withButton';

export interface ListRowProps {
  /**
   * navigation: trailing chevron. value: trailing value text + chevron. toggle: system Switch.
   * selectable: trailing primary checkmark when `selected` (sheet options). radio: leading Radio.
   * action: primary (or error when `destructive`) title, no trailing. withButton: trailing Button `sm`.
   */
  variant?: ListRowVariant;
  title: string;
  subtitle?: string;
  /** value variant. */
  value?: string;
  /** Leading concept glyph (md 20, textSecondary). */
  leadingIcon?: IoniconName;
  /** Custom leading element (Avatar, thumbnail). Pass `leadingWidth` so the divider can inset past it. */
  leading?: React.ReactNode;
  leadingWidth?: number;
  /** selectable / radio: the chosen option. */
  selected?: boolean;
  /** toggle. */
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  /** withButton. */
  buttonLabel?: string;
  onButtonPress?: () => void;
  buttonVariant?: 'primary' | 'secondary';
  buttonLoading?: boolean;
  /** error-coloured title + glyph (block, delete). */
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Row colour = the container it sits in: 'surface' (pages) or 'elevated' (BottomSheet; divider uses `border`). */
  on?: 'surface' | 'elevated';
  /** screen: full-bleed list, text starts at screenMargin. grouped: inside a rounded container, padding 16. */
  inset?: 'screen' | 'grouped';
  /** Hairline divider under the row, starting at the title's left edge. Omit it on the last row. */
  divider?: boolean;
  /** Settings rows use `body`; content rows (notifications, followers) use `subhead` with a 600 title. */
  density?: 'settings' | 'content';
  /** Inside a scroll container: delay the pressed state by 50ms. */
  inScroll?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** 20pt radio drawn with Views: 1.5pt ring, 10pt dot that grips in (scale 0.6 -> 1). Not a glyph. */
export function Radio({ selected }: { selected: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const { spring, reduceMotion, duration } = useMotion();
  const dot = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      Animated.timing(dot, { toValue: selected ? 1 : 0, duration: duration.short, useNativeDriver: USE_NATIVE_DRIVER }).start();
    } else if (selected) {
      dot.setValue(0.6);
      Animated.spring(dot, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    } else {
      dot.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const { radioSize, radioDot } = theme.componentSize;
  const c = theme.colors;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: radioSize,
        height: radioSize,
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.stroke.emphasis,
        borderColor: selected ? c.primary : c.outline,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          width: radioDot,
          height: radioDot,
          borderRadius: theme.borderRadius.full,
          backgroundColor: c.primary,
          opacity: dot,
          transform: [{ scale: dot }],
        }}
      />
    </View>
  );
}

function Check({ selected }: { selected: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const { spring, reduceMotion, duration } = useMotion();
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (!selected) {
      pop.setValue(0);
    } else if (reduceMotion) {
      Animated.timing(pop, { toValue: 1, duration: duration.short, useNativeDriver: USE_NATIVE_DRIVER }).start();
    } else {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, ...spring.grip, ...SPRING_REST, useNativeDriver: USE_NATIVE_DRIVER }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return (
    <View style={{ width: theme.iconSize.md, height: theme.iconSize.md }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ opacity: pop, transform: [{ scale: pop }] }}>
        <Ionicons name={ICON.selected.outline} size={theme.iconSize.md} color={theme.colors.primary} />
      </Animated.View>
    </View>
  );
}

/**
 * One list row (min 44, vertical padding 12). Press = whole-row `surfacePressed` wash (no scale).
 * Interactive trailing controls (Switch, Button) are SIBLINGS of the pressable body, never nested in it
 * (JSX order: row, then control). Card-less lists must sit on a `surface` container, not on the sand page.
 * At font scale >= 1.6 the `value` moves under the title and the `withButton` button moves under the text.
 */
export function ListRow({
  variant = 'navigation',
  title,
  subtitle,
  value,
  leadingIcon,
  leading,
  leadingWidth,
  selected = false,
  toggleValue = false,
  onToggle,
  buttonLabel,
  onButtonPress,
  buttonVariant = 'secondary',
  buttonLoading,
  destructive = false,
  disabled = false,
  onPress,
  on = 'surface',
  inset = 'grouped',
  divider = true,
  density = 'settings',
  inScroll,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps): React.JSX.Element {
  const { theme } = useTheme();
  const { screenMargin } = useLayout();
  const { fontScale } = useWindowDimensions();
  const c = theme.colors;
  const padH = inset === 'screen' ? screenMargin : theme.spacing.md;
  const stacked = fontScale >= 1.6;
  const elevated = on === 'elevated';

  const titleColor = disabled ? 'textDisabled' : destructive ? 'error' : variant === 'action' ? 'primary' : 'textPrimary';
  const glyphColor = disabled ? c.textDisabled : destructive ? c.error : c.textSecondary;
  const titleVariant = density === 'content' ? 'subhead' : 'body';
  const titleWeight = density === 'content' ? '600' : undefined;
  const subColor = disabled ? 'textDisabled' : 'textSecondary';
  const hasLeadingIcon = !!leadingIcon && variant !== 'radio';
  const leadW = variant === 'radio' ? theme.componentSize.radioSize : hasLeadingIcon ? theme.iconSize.md : (leading ? (leadingWidth ?? 0) : 0);
  const hasLead = leadW > 0 || !!leading;
  const showValueInline = variant === 'value' && !stacked;
  const hasChevron = variant === 'navigation' || variant === 'value';
  const sibling = variant === 'toggle' || variant === 'withButton';
  const siblingBelow = variant === 'withButton' && stacked;
  const pressable = !!onPress && !disabled;
  const role = variant === 'radio' || variant === 'selectable' ? 'radio' : 'button';

  const body = (
    <>
      {variant === 'radio' ? (
        <View style={{ marginRight: theme.spacing.smd }}>
          <Radio selected={selected} />
        </View>
      ) : hasLeadingIcon ? (
        <Ionicons name={leadingIcon as IoniconName} size={theme.iconSize.md} color={glyphColor} style={{ marginRight: theme.spacing.smd }} />
      ) : leading ? (
        <View style={{ marginRight: theme.spacing.smd }}>{leading}</View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant={titleVariant} weight={titleWeight} color={titleColor} numberOfLines={stacked ? undefined : 1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant={density === 'content' ? 'caption1' : 'footnote'} color={subColor} numberOfLines={density === 'content' ? 2 : 1} style={{ marginTop: theme.layout.stackTight }}>
            {subtitle}
          </AppText>
        ) : null}
        {variant === 'value' && stacked && value ? (
          <AppText variant="footnote" color={subColor} style={{ marginTop: theme.layout.stackTight }}>
            {value}
          </AppText>
        ) : null}
      </View>
      {showValueInline && value ? (
        <AppText variant="subhead" color={subColor} numberOfLines={1} style={{ marginLeft: theme.spacing.sm, flexShrink: 1, maxWidth: '50%' }}>
          {value}
        </AppText>
      ) : null}
      {hasChevron ? (
        <Ionicons
          name={ICON.forward.outline}
          size={theme.iconSize.sm}
          color={disabled ? c.textDisabled : c.textSecondary}
          style={{ marginLeft: theme.spacing.xs }}
          accessibilityElementsHidden
        />
      ) : null}
      {variant === 'selectable' ? (
        <View style={{ marginLeft: theme.spacing.sm }}>
          <Check selected={selected} />
        </View>
      ) : null}
    </>
  );

  const rowStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.layout.minTouchTarget,
    paddingVertical: theme.layout.listRowPaddingV,
    paddingLeft: padH,
    paddingRight: sibling && !siblingBelow ? theme.spacing.smd : padH,
  };

  return (
    <View style={[{ backgroundColor: elevated ? c.surfaceElevated : c.surface }, style]}>
      <View style={{ flexDirection: siblingBelow ? 'column' : 'row', alignItems: siblingBelow ? 'stretch' : 'center' }}>
        {pressable ? (
          <PressableScale
            feedback="row"
            inScroll={inScroll}
            onPress={onPress}
            pressedColor={c.surfacePressed}
            accessibilityRole={role}
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled, ...(role === 'radio' ? { checked: selected } : { selected: variant === 'selectable' ? selected : undefined }) }}
            accessible={variant === 'toggle' || variant === 'withButton' ? false : undefined}
            style={siblingBelow ? { ...rowStyle, flex: undefined } : rowStyle}
          >
            {body}
          </PressableScale>
        ) : (
          <View
            accessible={variant === 'toggle' || variant === 'withButton' ? false : true}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={role === 'radio' ? { checked: selected, disabled } : { disabled }}
            accessibilityRole={role === 'radio' ? 'radio' : undefined}
            style={siblingBelow ? { ...rowStyle, flex: undefined } : rowStyle}
          >
            {body}
          </View>
        )}
        {variant === 'toggle' ? (
          <View style={{ paddingRight: padH }}>
            <Switch
              value={toggleValue}
              disabled={disabled}
              onValueChange={onToggle}
              accessibilityLabel={title}
              trackColor={{ true: c.primary, false: c.surfaceAlt }}
              ios_backgroundColor={c.surfaceAlt}
            />
          </View>
        ) : null}
        {variant === 'withButton' && buttonLabel ? (
          <View style={siblingBelow ? { paddingLeft: padH + (hasLead ? leadW + theme.spacing.smd : 0), paddingBottom: theme.layout.listRowPaddingV, alignItems: 'flex-start' } : { paddingRight: padH }}>
            <Button
              variant={buttonVariant}
              size="sm"
              label={buttonLabel}
              loading={buttonLoading}
              disabled={disabled}
              onPress={() => onButtonPress?.()}
            />
          </View>
        ) : null}
      </View>
      {divider ? (
        <View
          pointerEvents="none"
          style={{
            height: theme.stroke.hairline,
            marginLeft: padH + (hasLead ? leadW + theme.spacing.smd : 0),
            backgroundColor: elevated ? c.border : c.divider,
          }}
        />
      ) : null}
    </View>
  );
}
