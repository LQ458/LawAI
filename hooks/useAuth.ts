"use client";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState } from "react";

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: {
    sub?: string;
    name?: string;
    email?: string;
    nickname?: string;
    picture?: string;
  } | null;
}

export const useAuth = (): UseAuthReturn => {
  const { user, isLoading: authLoading, error: authError } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  return {
    isAuthenticated: !!user,
    isLoading: authLoading || isLoading,
    error: authError?.message ?? null,
    user: user
      ? {
          sub: user.sub,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          nickname: user.nickname ?? undefined,
          picture: user.picture ?? undefined,
        }
      : null,
  };
};
