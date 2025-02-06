"use client";
import { Button } from "primereact/button";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="text-center space-y-8">
        <div className="relative">
          <h1 className="text-[150px] font-bold text-blue-600 opacity-20 select-none animate-pulse">
            404
          </h1>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl text-blue-800 whitespace-nowrap">
            页面未找到
          </div>
        </div>

        <p className="text-gray-600 text-lg max-w-md mx-auto">
          抱歉，您访问的页面不存在或已被移除。
        </p>

        <div className="space-y-4">
          <Button
            label="返回首页"
            icon="pi pi-home"
            severity="info"
            onClick={() => router.push("/")}
            className="px-6"
          />
        </div>
      </div>
    </div>
  );
}
