import { useCallback, useEffect, useRef, useState } from "react";

/** Gives live-data screens a consistent, brief pull-to-refresh indicator. */
export function usePullToRefresh(refreshData: () => void, minimumDurationMs = 650) {
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRefreshing(true);
    refreshData();
    timerRef.current = setTimeout(() => {
      setRefreshing(false);
      timerRef.current = undefined;
    }, minimumDurationMs);
  }, [minimumDurationMs, refreshData]);

  return { onRefresh, refreshing };
}
