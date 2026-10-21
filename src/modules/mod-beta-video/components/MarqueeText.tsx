/**
 * MarqueeText — pure-JS translateX marquee for overflowing text (AC-137).
 *
 * Renders `text` inside an `overflow:'hidden'` container. If the text is wider
 * than `containerWidth`, a looping `Animated.translateX` marquee scrolls it.
 * No native package — pure RN Animated (AC-137).
 *
 * RN-Core Marquee for Text-Overflow Scroll (production.md convention):
 * Uses RN core `Animated` translateX loop, never a native marquee package.
 */

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, View } from 'react-native';
import { bezierFor, USE_NATIVE_DRIVER } from '../../../lib/motion';

/** Duration of one marquee scroll pass in milliseconds (AC-137). */
const MARQUEE_DURATION_MS = 4000;

export interface MarqueeTextProps {
  text: string;
  containerWidth: number;
  style?: object;
  testID?: string;
  /** Reduce Motion: no scrolling, the single line is truncated instead. */
  reduceMotion?: boolean;
}

export function MarqueeText({ text, containerWidth, style, testID, reduceMotion = false }: MarqueeTextProps): React.JSX.Element {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!reduceMotion && textWidth > containerWidth && containerWidth > 0) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: -(textWidth - containerWidth),
            duration: MARQUEE_DURATION_MS,
            easing: bezierFor('linear'),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay(1000),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 0,
            easing: bezierFor('linear'),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay(500),
        ]),
      );
      animRef.current.start();
    } else {
      // Reset when text fits or container width not yet known
      translateX.setValue(0);
      animRef.current?.stop();
    }

    return () => {
      animRef.current?.stop();
    };
  }, [textWidth, containerWidth, translateX, reduceMotion]);

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.Text
        maxFontSizeMultiplier={1.6}
        style={[style, { transform: [{ translateX }] }]}
        onTextLayout={(e) => {
          const lineWidth = e.nativeEvent.lines[0]?.width ?? 0;
          setTextWidth(lineWidth);
        }}
        numberOfLines={1}
        testID={testID}
      >
        {text}
      </Animated.Text>
    </View>
  );
}
