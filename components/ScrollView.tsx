import { useEffect, RefObject } from "react";
import { Chat } from "../types";

interface ScrollViewProps {
  data: Chat | null; // 聊天数据
  ref: RefObject<HTMLDivElement>; // 滚动容器引用
  threshold?: number; // 滚动阈值
}

const ScrollView = ({ data, ref, threshold = 100 }: ScrollViewProps) => {
  useEffect(() => {
    const scrollContainer = ref.current?.parentElement;
    if (!scrollContainer) return;

    // 检查是否接近底部
    const isNearBottom = () => {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainer;
      return scrollHeight - scrollTop - clientHeight < threshold;
    };

    // 只有在用户接近底部时才自动滚动
    if (isNearBottom()) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [data, ref, threshold]);

  return null;
};

export default ScrollView;
