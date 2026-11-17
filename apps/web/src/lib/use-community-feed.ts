"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityListingDTO, CommunityListingFeedResponse } from "@voi/shared";
import { publicRequest } from "./api-client";

const EMPTY_LISTINGS: CommunityListingDTO[] = [];

/** Public listings stay anonymous even when embedded in a signed-in feed. */
export function useCommunityFeed(enabled: boolean, skillLevel: string) {
  const query = new URLSearchParams({ limit: "20", ...(skillLevel ? { skillLevel } : {}) }).toString();
  const key = enabled ? query : null;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    feed: CommunityListingFeedResponse | null;
    loading: boolean;
    loadingMore: boolean;
    error: boolean;
    moreError: boolean;
  }>({ key: null, feed: null, loading: false, loadingMore: false, error: false, moreError: false });
  const generation = useRef(0);
  const morePending = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const current = ++generation.current;
    morePending.current = false;
    setState({ key, feed: null, loading: key !== null, loadingMore: false, error: false, moreError: false });
    if (key === null) return;
    const controller = new AbortController();
    controllers.current.add(controller);
    void publicRequest<CommunityListingFeedResponse>(`/community-listings?${key}`, { signal: controller.signal })
      .then((feed) => {
        if (current === generation.current) setState((previous) => ({ ...previous, feed }));
      })
      .catch(() => {
        if (current === generation.current) setState((previous) => ({ ...previous, error: true }));
      })
      .finally(() => {
        controllers.current.delete(controller);
        if (current === generation.current) setState((previous) => ({ ...previous, loading: false }));
      });
    const pending = controllers.current;
    return () => {
      ++generation.current;
      for (const request of pending) request.abort();
      pending.clear();
    };
  }, [key, revision]);

  const loadMore = useCallback(async () => {
    const cursor = state.key === key ? state.feed?.nextCursor : null;
    if (key === null || !cursor || morePending.current) return;
    const current = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    morePending.current = true;
    setState((previous) => ({ ...previous, loadingMore: true, moreError: false }));
    try {
      const next = await publicRequest<CommunityListingFeedResponse>(
        `/community-listings?${key}&cursor=${encodeURIComponent(cursor)}`,
        { signal: controller.signal },
      );
      if (current !== generation.current) return;
      setState((previous) => ({
        ...previous,
        feed: {
          listings: [...(previous.feed?.listings ?? []), ...next.listings]
            .filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index),
          nextCursor: next.nextCursor,
        },
      }));
    } catch {
      if (current === generation.current) setState((previous) => ({ ...previous, moreError: true }));
    } finally {
      controllers.current.delete(controller);
      if (current === generation.current) {
        morePending.current = false;
        setState((previous) => ({ ...previous, loadingMore: false }));
      }
    }
  }, [key, state.key, state.feed?.nextCursor]);

  const active = key !== null && state.key === key;
  return {
    listings: active ? state.feed?.listings ?? EMPTY_LISTINGS : EMPTY_LISTINGS,
    nextCursor: active ? state.feed?.nextCursor ?? null : null,
    loading: key !== null && (!active || state.loading),
    loadingMore: active && state.loadingMore,
    error: active && state.error,
    moreError: active && state.moreError,
    reload,
    loadMore,
  };
}
