import { useEffect, useRef, useCallback, RefObject } from "react";
import debounce from "lodash/debounce";

/**
 * 滚动管理器选项接口
 */
interface ScrollManagerOptions {
  threshold?: number; // 滚动阈值，用于判断是否触发自动滚动
  smoothScroll?: boolean; // 是否启用平滑滚动
  debounceMs?: number; // 防抖延迟时间
  markdownRendered?: boolean; // Markdown 是否已渲染完成
  isAIGenerating?: boolean; // AI 是否正在生成内容
  isMobileScreen?: boolean; // 是否为移动设备屏幕
  pageSize?: number; // 每页显示的消息数量
  endRef?: RefObject<HTMLDivElement>; // 滚动目标元素的引用
}

/**
 * 滚动管理器 Hook
 * 用于管理聊天界面的滚动行为，包括自动滚动、滚动趋势分析等功能
 */
export function useScrollManager(options: ScrollManagerOptions = {}) {
  // 提取选项参数，设置默认值
  const {
    threshold = 50,
    smoothScroll = true,
    debounceMs = 150,
    pageSize = 20,
  } = options;

  // 状态引用
  const containerRef = useRef<HTMLDivElement>(null); // 容器元素引用
  const isAutoScrollingRef = useRef(false); // 是否正在自动滚动
  const shouldAutoScrollRef = useRef(true); // 是否应该自动滚动
  const initialScrollRef = useRef(true); // 是否为初始滚动
  const userScrolledRef = useRef(false); // 用户是否主动滚动
  const isMountedRef = useRef(false); // 组件是否已挂载
  const rafIdRef = useRef<number>(); // requestAnimationFrame ID
  const lastScrollHeightRef = useRef(0); // 上一次滚动高度
  const lastScrollTopRef = useRef(0); // 上一次滚动位置
  const messageRenderIndexRef = useRef(pageSize); // 消息渲染索引

  // 防抖处理器引用
  const debouncedScrollHandlerRef = useRef<ReturnType<typeof debounce>>();
  const debouncedResizeHandlerRef = useRef<ReturnType<typeof debounce>>();

  /**
   * 滚动趋势分析状态
   * 用于跟踪和分析用户的滚动行为
   */
  const scrollTrendRef = useRef({
    lastScrollTime: Date.now(),
    scrollDirectionDown: true,
    scrollTrend: [] as { position: number; time: number }[],
    readingPosition: 0,
    isReading: false,
  });

  /**
   * 分析滚动趋势
   * 通过分析最近的滚动行为来判断用户是否在阅读
   */
  const analyzeScrollTrend = useCallback(() => {
    const trend = scrollTrendRef.current;
    const now = Date.now();

    // 只保留最近1秒内的滚动记录
    trend.scrollTrend = trend.scrollTrend.filter((t) => now - t.time < 1000);

    if (trend.scrollTrend.length >= 2) {
      const recentScrolls = trend.scrollTrend.slice(-2);
      // 计算滚动速度
      const velocity =
        (recentScrolls[1].position - recentScrolls[0].position) /
        (recentScrolls[1].time - recentScrolls[0].time);

      trend.scrollDirectionDown = velocity > 0;

      // 如果滚动速度很慢，认为用户在阅读
      if (Math.abs(velocity) < 0.1) {
        trend.isReading = true;
        trend.readingPosition = recentScrolls[1].position;
      } else {
        trend.isReading = false;
      }
    }
  }, []);

  /**
   * 检查滚动边缘
   * 判断是否触及容器顶部或底部
   */
  const checkEdges = useCallback(
    (container: HTMLElement) => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const bottomHeight = scrollTop + clientHeight;
      const edgeThreshold = clientHeight;

      const isTouchTopEdge = scrollTop <= edgeThreshold;
      const isTouchBottomEdge = bottomHeight >= scrollHeight - edgeThreshold;
      const isHitBottom =
        bottomHeight >= scrollHeight - (options.isMobileScreen ? 4 : 10);

      return {
        isTouchTopEdge,
        isTouchBottomEdge,
        isHitBottom,
      };
    },
    [options.isMobileScreen],
  );

  /**
   * 检查是否应该自动滚动
   * 根据内容变化和滚动位置判断
   */
  const checkShouldScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || isAutoScrollingRef.current) return false;

    const { scrollHeight, scrollTop } = container;
    const currentScrollHeight = scrollHeight;
    const hasNewContent = currentScrollHeight > lastScrollHeightRef.current;
    lastScrollHeightRef.current = currentScrollHeight;

    if (options.isAIGenerating && hasNewContent) {
      const { isHitBottom, isTouchBottomEdge } = checkEdges(container);

      if (isHitBottom || isTouchBottomEdge) {
        shouldAutoScrollRef.current = true;
        return true;
      }

      if (scrollTop < lastScrollTopRef.current - threshold) {
        shouldAutoScrollRef.current = false;
        return false;
      }
    }

    return shouldAutoScrollRef.current;
  }, [threshold, options.isAIGenerating, checkEdges]);

  /**
   * 检查滚动完成状态
   * 处理滚动完成后的操作
   */
  const checkScrollComplete = useCallback(
    (container: HTMLElement) => {
      const { isHitBottom } = checkEdges(container);
      if (isHitBottom && !isAutoScrollingRef.current) {
        // if (options.markdownRendered && shouldAutoScrollRef.current) {
        //   scrollToBottom();
        //   console.log("checkScrollComplete");
        // }
      }
    },
    [checkEdges, options.markdownRendered],
  );

  /**
   * 处理滚动事件
   * 统一处理滚动相关的逻辑
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const container = event.target as HTMLElement;
      if (!container) return;

      const { scrollTop } = container;
      const isScrollingUp = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;

      // 处理向上滚动
      if (isScrollingUp && options.isAIGenerating) {
        userScrolledRef.current = true;
        shouldAutoScrollRef.current = false;
        return;
      }

      // 分析滚动趋势并检查完成状态
      analyzeScrollTrend();
      checkScrollComplete(container);

      // 检查是否需要自动滚动
      const shouldScroll = checkShouldScroll();
      if (shouldScroll) {
        userScrolledRef.current = false;
        shouldAutoScrollRef.current = true;
        scrollToBottom();
        console.log("handleScroll");
      }
    },
    [
      analyzeScrollTrend,
      checkScrollComplete,
      checkShouldScroll,
      options.isAIGenerating,
    ],
  );

  /**
   * 滚动到底部
   * 处理自动滚动和手动滚动到底部的逻辑
   */
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    const endElement = options.endRef?.current;

    if (
      !container ||
      (!shouldAutoScrollRef.current && !initialScrollRef.current)
    )
      return;

    // 取消之前的动画帧
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    isAutoScrollingRef.current = true;

    // 使用 requestAnimationFrame 确保平滑滚动
    rafIdRef.current = requestAnimationFrame(() => {
      if (container && isMountedRef.current) {
        // 处理滚动到指定元素或容器底部
        if (endElement) {
          endElement.scrollIntoView({
            behavior: smoothScroll ? "smooth" : "auto",
            block: "end",
          });
        } else {
          const scrollOptions = {
            top: container.scrollHeight,
            behavior: smoothScroll ? "smooth" : ("auto" as ScrollBehavior),
          };
          container.scrollTo(scrollOptions);
        }

        // 更新状态
        initialScrollRef.current = false;
        messageRenderIndexRef.current = Math.max(
          pageSize,
          container.scrollHeight,
        );

        // 处理平滑滚动的完成事件
        if (smoothScroll) {
          const handleScrollEnd = () => {
            isAutoScrollingRef.current = false;
            container.removeEventListener("scrollend", handleScrollEnd);
          };
          container.addEventListener("scrollend", handleScrollEnd, {
            once: true,
          });

          // 设置超时以确保滚动完成
          setTimeout(() => {
            isAutoScrollingRef.current = false;
            shouldAutoScrollRef.current = false;
          }, 300);
        } else {
          isAutoScrollingRef.current = false;
          shouldAutoScrollRef.current = false;
        }
      }
    });
  }, [smoothScroll, options.endRef]);

  // 组件生命周期相关的副作用
  useEffect(() => {
    isMountedRef.current = true;

    // 设置防抖的滚动处理器
    debouncedScrollHandlerRef.current = debounce(() => {
      const container = containerRef.current;
      if (!container || isAutoScrollingRef.current) return;

      const { scrollTop } = container;
      const isScrollingUp = scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;

      if (isScrollingUp && options.isAIGenerating) {
        userScrolledRef.current = true;
        shouldAutoScrollRef.current = false;
        return;
      }

      const shouldScroll = checkShouldScroll();
      if (shouldScroll) {
        userScrolledRef.current = false;
        shouldAutoScrollRef.current = true;
        scrollToBottom();
        console.log("debouncedScrollHandlerRef");
      }
    }, debounceMs);

    // 设置防抖的调整大小处理器
    debouncedResizeHandlerRef.current = debounce(() => {
      if (
        isMountedRef.current &&
        shouldAutoScrollRef.current &&
        !userScrolledRef.current
      ) {
        scrollToBottom();
      }
    }, debounceMs);

    // 清理函数
    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      debouncedScrollHandlerRef.current?.cancel();
      debouncedResizeHandlerRef.current?.cancel();
    };
  }, [debounceMs, options.isAIGenerating, checkShouldScroll, scrollToBottom]);

  // 返回公共接口
  return {
    containerRef,
    shouldAutoScroll: shouldAutoScrollRef.current,
    scrollToBottom,
    messageRenderIndex: messageRenderIndexRef.current,
    resetScroll: () => {
      userScrolledRef.current = false;
      shouldAutoScrollRef.current = true;
      scrollToBottom();
    },
    handleScroll,
    analyzeScrollTrend,
  };
}
