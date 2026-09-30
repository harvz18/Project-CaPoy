import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  CapturedLocation,
  ForegroundLocationSubscription,
  ForegroundLocationWatchError,
  startForegroundLocationWatch
} from "../services/locationService";

export type ForegroundLocationWatchStatus = "idle" | "starting" | "watching" | "paused" | "error";

export function useForegroundLocationWatch(enabled: boolean) {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [attempt, setAttempt] = useState(0);
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [location, setLocation] = useState<CapturedLocation>();
  const [issue, setIssue] = useState<ForegroundLocationWatchError>();
  const [status, setStatus] = useState<ForegroundLocationWatchStatus>("idle");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || appState !== "active") return;
    const timer = setInterval(() => setCheckedAt(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [appState, enabled]);

  useEffect(() => {
    let cancelled = false;
    let subscription: ForegroundLocationSubscription | undefined;

    if (!enabled) {
      setStatus("idle");
      setIssue(undefined);
      setLocation(undefined);
      return;
    }
    if (appState !== "active") {
      setStatus("paused");
      return;
    }

    setStatus("starting");
    setIssue(undefined);
    startForegroundLocationWatch(
      (next) => {
        if (cancelled) return;
        setLocation(next);
        setCheckedAt(Date.now());
        setStatus("watching");
      },
      (error) => {
        if (cancelled) return;
        subscription?.remove();
        subscription = undefined;
        setIssue(error);
        setStatus("error");
      }
    ).then((startedSubscription) => {
      if (cancelled) {
        startedSubscription.remove();
        return;
      }
      subscription = startedSubscription;
      setStatus("watching");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setIssue(error instanceof ForegroundLocationWatchError
        ? error
        : new ForegroundLocationWatchError("unavailable", "Unable to start live location. Check GPS and retry."));
      setStatus("error");
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [appState, attempt, enabled]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { checkedAt, issue, location, retry, status };
}
