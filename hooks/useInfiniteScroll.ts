import { useCallback, useRef } from "react";

export function useInfiniteScroll(
  loading: boolean,
  hasMore: boolean,
  loadMore: () => void,
) {
  const observer = useRef<IntersectionObserver>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;

      if (observer.current) {
        observer.current.disconnect();
      }

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) {
        observer.current.observe(node);
      }
    },
    [loading, hasMore, loadMore],
  );

  return lastElementRef;
}
