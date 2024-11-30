"use client";

import { useEffect } from "react";

/**
 * 自定义 Hook 用于设置用户认证状态
 * @param status - 用户的认证状态
 * @param setShowAuth - 设置是否显示引导的函数
 */

const SetAuth = (status: string, setShowAuth: (show: boolean) => void) => {
  useEffect(() => {
    if (status === "unauthenticated") {
      setShowAuth(true);
    } else if (status === "authenticated") {
      setShowAuth(false);
    }
  }, [status]); // 处理未登录状态
};

export default SetAuth;
