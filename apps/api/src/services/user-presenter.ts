import type { User } from "@prisma/client";

export function presentUserSummary(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    defaultSkillLevel: user.defaultSkillLevel
  };
}
