import { PrismaClient } from "@prisma/client";

// Prisma error events may contain mutation arguments (raw posts, contacts, hashes).
// Route/services record safe error codes instead of emitting query parameters.
export const prisma = new PrismaClient({ log: [] });
