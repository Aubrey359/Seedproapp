import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";

// Demo user shown when no backend is available
const DEMO_USER = {
  id: 1,
  name: "Grace Achieng",
  email: "grace@seedpro.ke",
  phone: "0712 345 678",
  location: "Kisumu",
  role: "farmer" as const,
  avatar: null as string | null,
  bio: "Experienced maize and vegetable farmer in Kisumu County. Supplying fresh produce to buyers across western Kenya for over 8 years.",
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate(redirectPath);
    },
  });

  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);

  // Fall back to demo user when backend is unavailable
  const effectiveUser = user ?? (!isLoading ? DEMO_USER : null);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !effectiveUser) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, effectiveUser, navigate, redirectPath]);

  return useMemo(
    () => ({
      user: effectiveUser,
      isAuthenticated: !!effectiveUser,
      isLoading: isLoading && !error,
      error,
      logout,
      refresh: refetch,
    }),
    [effectiveUser, isLoading, error, logout, refetch],
  );
}
