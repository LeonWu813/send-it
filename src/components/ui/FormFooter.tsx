import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USE_NATIVE_DRIVER, bezierFor, useMotion } from '../../lib/motion';
import { useLayout, useTheme } from '../../lib/theme';

export interface FormFooterProps {
  children: React.ReactNode;
  /** Show the top hairline: content is scrolled under the footer. Drive it with `useFooterScroll`. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Sticky form footer: a sibling AFTER the ScrollView, `background` fill, no shadow. The top hairline fades
 * in (`micro`) only while content sits under it. Padding: top `sm`, sides `screenMargin`, bottom
 * max(safe-area bottom, `md`); with the keyboard open the bottom is `md` and the footer rides above the keyboard.
 */
export function FormFooter({ children, divider = false, style }: FormFooterProps): React.JSX.Element {
  const { theme } = useTheme();
  const { duration, reduceMotion } = useMotion();
  const { screenMargin } = useLayout();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const line = useRef(new Animated.Value(divider ? 1 : 0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKeyboard(true));
    const b = Keyboard.addListener(hideEvt, () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(line, {
      toValue: divider ? 1 : 0,
      duration: reduceMotion ? 0 : duration.micro,
      easing: bezierFor('standard'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [divider, line, duration.micro, reduceMotion]);

  const { sm, md } = theme.spacing;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          { backgroundColor: theme.colors.background, paddingTop: sm, paddingHorizontal: screenMargin, paddingBottom: keyboard ? md : Math.max(insets.bottom, md) },
          style,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.line, { backgroundColor: theme.colors.border, height: theme.stroke.hairline, opacity: line }]}
        />
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', top: 0, left: 0, right: 0 },
});

/**
 * Tracks whether scroll content extends under the footer (`contentHeight - scrollY - viewportHeight > 0`).
 * Spread `scrollProps` on the ScrollView and pass `divider` to FormFooter.
 */
export function useFooterScroll(): {
  divider: boolean;
  scrollProps: {
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange: (w: number, h: number) => void;
    onLayout: (e: LayoutChangeEvent) => void;
    scrollEventThrottle: number;
  };
} {
  const m = useRef({ y: 0, content: 0, viewport: 0 });
  const [divider, setDivider] = useState(false);
  const update = useCallback(() => {
    const { y, content, viewport } = m.current;
    const next = content - y - viewport > 0.5;
    setDivider((prev) => (prev === next ? prev : next));
  }, []);
  return {
    divider,
    scrollProps: {
      onScroll: (e) => {
        m.current.y = e.nativeEvent.contentOffset.y;
        m.current.content = e.nativeEvent.contentSize.height;
        m.current.viewport = e.nativeEvent.layoutMeasurement.height;
        update();
      },
      onContentSizeChange: (_w, h) => {
        m.current.content = h;
        update();
      },
      onLayout: (e) => {
        m.current.viewport = e.nativeEvent.layout.height;
        update();
      },
      scrollEventThrottle: 16,
    },
  };
}
