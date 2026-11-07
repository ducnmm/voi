"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api-client";
import { useAuth } from "./auth";
export function useResource<T>(path: string | null) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!path || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await request<T>(path, { token });
      if (generation.current === current) setData(next);
    } catch (err) {
      if (generation.current === current)
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [path, token]);
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      ++generation.current;
    };
  }, [reload]);
  return { data, setData, error, setError, loading, reload };
}
