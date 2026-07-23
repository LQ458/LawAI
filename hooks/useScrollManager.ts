import { useEffect, useMemo, useRef } from "react";
import debounce from "lodash/debounce";

interface ScrollManagerOptions {
  smoothScroll?: boolean;
  debounceMs?: number;
}

export function useScrollManager(options: ScrollManagerOptions = {}) {
  const { smoothScroll = true, debounceMs = 100 } = options;
  const isScrollingRef = useRef(false);

  const scrollToBottom = useMemo(
    () =>
      debounce((container: HTMLElement) => {
        if (!container || isScrollingRef.current) return;

        isScrollingRef.current = true;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smoothScroll ? "smooth" : "auto",
        });

        setTimeout(() => {
          isScrollingRef.current = false;
        }, 100);
      }, debounceMs),
    [debounceMs, smoothScroll],
  );

  useEffect(() => () => scrollToBottom.cancel(), [scrollToBottom]);

  return {
    scrollToBottom,
    isAtBottom: (container: HTMLElement) => {
      if (!container) return true;
      const { scrollHeight, scrollTop, clientHeight } = container;
      return scrollHeight - (scrollTop + clientHeight) < 30;
    },
  };
}
