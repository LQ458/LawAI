"use client";
import { driver, DriveStep } from "driver.js";
import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";

/**
 * 自定义 Hook 用于管理用户引导（Tour）功能
 * @param steps - 引导的步骤数组
 * @param status - 用户的认证状态
 */
const UseTour = (steps: DriveStep[], status: string) => {
  // 使用 useRef 来存储 driver 实例，避免在组件重新渲染时重新创建
  const driverObj = useRef(
    driver({
      showProgress: true, // 显示进度条
      steps: steps, // 引导的步骤
      nextBtnText: "下一步", // 下一步按钮文本
      prevBtnText: "上一步", // 上一步按钮文本
      doneBtnText: "完成", // 完成按钮文本
      showButtons: ["next", "previous", "close"], // 显示的按钮
    }),
  );

  // 当 steps 发生变化时，更新 driver 实例
  useEffect(() => {
    driverObj.current = driver({
      showProgress: true,
      steps: steps as DriveStep[],
      nextBtnText: "下一步",
      prevBtnText: "上一步",
      doneBtnText: "完成",
      showButtons: ["next", "previous", "close"],
    });
  }, [steps]); // 依赖于 steps，确保在步骤变化时更新

  // 监听用户认证状态的变化，决定是否启动引导
  useEffect(() => {
    // 从 localStorage 中获取是否显示引导的标志
    const showTour = localStorage.getItem("showTour") === "true";

    // 如果标志为 true 且状态已确定（已登录或未登录，排除 loading 状态），则启动引导
    if (showTour && (status === "authenticated" || status === "unauthenticated")) {
      // 增加延迟，确保 DOM 完全加载后再启动引导
      setTimeout(() => {
        console.log("Starting tour for", status, "user...");
        try {
          driverObj.current.drive(); // 启动引导
          localStorage.removeItem("showTour"); // 清除标志，避免重复显示
        } catch (error) {
          console.error("Tour error:", error); // 捕捉并打印引导错误
        }
      }, 500); // 延迟 0.5 秒启动
    }
  }, [status]); // 依赖于 status，确保在认证状态变化时触发
};

export default UseTour;
