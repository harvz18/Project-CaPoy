import type { Href } from "expo-router";
import type { Authority, Role } from "../types";

type BackRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

export function getRoleHomeRoute(role?: Role, authority?: Authority): Href {
  if (authority === "superadmin") return "/superadmin";
  if (authority === "admin" || role === "admin") return "/admin";
  if (role === "worker") return "/worker-dashboard";
  if (role === "client") return "/client-dashboard";
  return "/login";
}

export function goBackOrHome(router: BackRouter, role?: Role, authority?: Authority) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(getRoleHomeRoute(role, authority));
}
