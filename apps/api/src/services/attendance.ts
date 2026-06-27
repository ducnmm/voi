import type { RsvpStatus } from "@prisma/client";

export function calculateNextWaitlistPosition(
  currentPositions: Array<number | null>
): number {
  const maxPosition = currentPositions.reduce<number>((max, position) => {
    if (position === null) {
      return max;
    }

    return Math.max(max, position);
  }, 0);

  return maxPosition + 1;
}

export function resolveJoinStatus(input: {
  joinedCount: number;
  maxPlayers: number;
  existingStatus?: RsvpStatus;
}): RsvpStatus {
  if (input.existingStatus === "JOINED") {
    return "JOINED";
  }

  return input.joinedCount < input.maxPlayers ? "JOINED" : "WAITLISTED";
}
