export function calculateTotalCostVnd(input: {
  feeTotalVnd?: number | null;
  shuttlecockCostVnd?: number | null;
  feePerPlayerVnd?: number | null;
  joinedPlayerCount?: number;
}): number {
  // A host-set fixed price means the total collected is price × joined players.
  if (input.feePerPlayerVnd != null) {
    return input.feePerPlayerVnd * (input.joinedPlayerCount ?? 0);
  }

  return (input.feeTotalVnd ?? 0) + (input.shuttlecockCostVnd ?? 0);
}

export function calculatePerPlayerCostVnd(input: {
  feeTotalVnd?: number | null;
  shuttlecockCostVnd?: number | null;
  feePerPlayerVnd?: number | null;
  joinedPlayerCount: number;
}): number | null {
  // Fixed price is known up front, independent of how many have joined.
  if (input.feePerPlayerVnd != null) {
    return input.feePerPlayerVnd;
  }

  if (input.joinedPlayerCount <= 0) {
    return null;
  }

  return Math.ceil(calculateTotalCostVnd(input) / input.joinedPlayerCount);
}
