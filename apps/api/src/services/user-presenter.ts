import type { SkillLevel } from "@prisma/client";

export const userSummarySelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  defaultSkillLevel: true
} as const;

export function presentUserSummary(user: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  defaultSkillLevel: SkillLevel;
}) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    defaultSkillLevel: user.defaultSkillLevel
  };
}
