import { User } from "next-auth";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getOrCreateGuestId } from "@/lib/guestSession";

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  guestId: string | null; // 临时用户ID
  userIdentifier: string; // 统一标识符 (userId 或 guestId)
}

export const useAuth = (): UseAuthReturn => {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 如果未认证,创建或获取临时用户ID
        if (status === "unauthenticated") {
          const identity = getOrCreateGuestId();
          setGuestId(identity.guestId);
        } else {
          setGuestId(null);
        }

        // 检查localStorage中是否有登录状态
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

  // 统一标识符: 已登录用户使用email/name, 未登录用户使用guestId
  const userIdentifier = session?.user?.email || 
                          session?.user?.name || 
                          guestId || 
                          '';

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading" || isLoading,
    error,
    user: session?.user as User | null,
    guestId,
    userIdentifier,
  };
};
