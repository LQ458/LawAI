import { User } from "next-auth";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
}

export const useAuth = (): UseAuthReturn => {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查localStorage中是否有登录状态
    const checkAuth = async () => {
      try {
        const storedAuth = localStorage.getItem("auth");
        if (storedAuth && status === "unauthenticated") {
          // 尝试恢复会话
          await fetch("/api/auth/session");
        }
      } catch (err) {
        console.error(err);
        setError("登录状态验证失败");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [status]);

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading" || isLoading,
    error,
    user: session?.user as User | null,
  };
};
