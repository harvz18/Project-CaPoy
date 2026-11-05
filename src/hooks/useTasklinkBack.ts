import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useApp } from "../context/AppContext";
import { goBackOrHome } from "../utils/navigation";

export function useTasklinkBack() {
  const router = useRouter();
  const { authority, currentUser } = useApp();

  return useCallback(() => {
    goBackOrHome(router, currentUser?.role, authority);
  }, [authority, currentUser?.role, router]);
}
