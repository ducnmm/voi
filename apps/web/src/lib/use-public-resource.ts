"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, publicRequest } from "./api-client";

export function usePublicResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setData(null);
    setError(null);
    setLoading(true);
    void publicRequest<T>(path, { signal: controller.signal })
      .then((result) => {
        if (current === generation.current) setData(result);
      })
      .catch((reason: unknown) => {
        if (current === generation.current)
          setError(reason instanceof ApiError ? reason : new ApiError(0, "network_error", "Không thể tải dữ liệu."));
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => {
      ++generation.current;
      controller.abort();
    };
  }, [path, revision]);
  return { data, error, loading, reload };
}
