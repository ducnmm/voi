import { prisma } from "../db/prisma.js";
import { forbidden, unauthorized } from "../utils/api-error.js";

export async function assertCanAccessSession(
  session: { groupId: string; visibility: string },
  userId: string | null
): Promise<void> {
  if (session.visibility !== "GROUP_ONLY") {
    return;
  }
  if (!userId) {
    throw unauthorized();
  }
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: session.groupId,
        userId
      }
    },
    select: { groupId: true }
  });
  if (!membership) {
    throw forbidden("This session is only visible to group members");
  }
}
