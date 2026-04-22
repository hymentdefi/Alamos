import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  Dimensions,
  FlatList,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

export interface HorizontalPagerHandle {
  scrollToIndex: (i: number, animated?: boolean) => void;
}

interface Props<T> {
  items: T[];
  index: number;
  onIndexChange: (i: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  /** Optional: fired while the user is actively scrolling (for prefetch / UI hints). */
  onScrollingIndex?: (idx: number) => void;
}

/**
 * Carrusel horizontal estilo TikTok: cada página ocupa el ancho completo,
 * el swipe sigue al dedo y los vecinos se ven durante el drag. Usa el
 * horizontal FlatList nativo con pagingEnabled para que sea smooth y
 * soporte nested vertical scroll sin conflictos.
 */
function HorizontalPagerInner<T>(
  { items, index, onIndexChange, renderItem, keyExtractor, onScrollingIndex }: Props<T>,
  ref: React.Ref<HorizontalPagerHandle>,
) {
  const { width: screenW } = Dimensions.get("window");
  const listRef = useRef<FlatList<T>>(null);
  const lastIndex = useRef(index);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (i, animated = true) => {
        lastIndex.current = i;
        listRef.current?.scrollToOffset({
          offset: i * screenW,
          animated,
        });
      },
    }),
    [screenW],
  );

  // Sincronizar con cambios externos del index (p. ej. tap en un pill).
  useEffect(() => {
    if (index !== lastIndex.current) {
      listRef.current?.scrollToOffset({
        offset: index * screenW,
        animated: true,
      });
      lastIndex.current = index;
    }
  }, [index, screenW]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / screenW);
      if (idx !== lastIndex.current) {
        lastIndex.current = idx;
        Haptics.selectionAsync().catch(() => {});
        onIndexChange(idx);
      }
    },
    [screenW, onIndexChange],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onScrollingIndex) return;
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / screenW);
      onScrollingIndex(idx);
    },
    [screenW, onScrollingIndex],
  );

  const getItemLayout = useCallback<NonNullable<FlatListProps<T>["getItemLayout"]>>(
    (_, i) => ({ length: screenW, offset: screenW * i, index: i }),
    [screenW],
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={keyExtractor}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      directionalLockEnabled
      decelerationRate="fast"
      disableIntervalMomentum
      initialNumToRender={1}
      windowSize={3}
      maxToRenderPerBatch={2}
      removeClippedSubviews
      initialScrollIndex={index}
      getItemLayout={getItemLayout}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onMomentumScrollEnd={onMomentumEnd}
      renderItem={({ item, index: i }) => (
        <View style={{ width: screenW }}>{renderItem(item, i)}</View>
      )}
    />
  );
}

// Preserva genéricos a través de forwardRef.
export const HorizontalPager = forwardRef(HorizontalPagerInner) as <T>(
  props: Props<T> & { ref?: React.Ref<HorizontalPagerHandle> },
) => ReturnType<typeof HorizontalPagerInner>;
