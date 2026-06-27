export type SessionSortKey = "date" | "price" | "spots";
export type SessionScope = "upcoming" | "past";

export interface SessionCursor {
  startsAt: Date;
  id: string;
}

/** Keyset cursor: ISO start time + id, so pages never overlap or skip. */
export function encodeSessionCursor(input: { startsAt: Date; id: string }): string {
  return `${input.startsAt.toISOString()}|${input.id}`;
}

export function decodeSessionCursor(raw: string): SessionCursor | null {
  // The ISO timestamp never contains "|", so the first separator splits it from
  // the id (which may legitimately contain "|").
  const separator = raw.indexOf("|");
  if (separator < 0) {
    return null;
  }

  const iso = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  const startsAt = new Date(iso);

  if (!id || Number.isNaN(startsAt.getTime())) {
    return null;
  }

  return { startsAt, id };
}

export interface FeedSortable {
  startsAt: Date;
  id: string;
  perPlayerCostVnd: number | null;
  availableSlots: number;
}

/**
 * Sort comparator for the in-memory price/spots sorts. Date order is the
 * tiebreak (and the DB-level order for the default sort): upcoming shows the
 * soonest first, past shows the most recent first.
 */
export function compareSessionsBy(sort: SessionSortKey, scope: SessionScope) {
  return (a: FeedSortable, b: FeedSortable): number => {
    if (sort === "price") {
      const priceA = a.perPlayerCostVnd ?? Number.MAX_SAFE_INTEGER;
      const priceB = b.perPlayerCostVnd ?? Number.MAX_SAFE_INTEGER;
      if (priceA !== priceB) {
        return priceA - priceB; // cheapest first
      }
    } else if (sort === "spots") {
      if (a.availableSlots !== b.availableSlots) {
        return b.availableSlots - a.availableSlots; // most open first
      }
    }

    const timeA = a.startsAt.getTime();
    const timeB = b.startsAt.getTime();
    if (timeA !== timeB) {
      return scope === "upcoming" ? timeA - timeB : timeB - timeA;
    }

    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? -1 : 1;
  };
}
