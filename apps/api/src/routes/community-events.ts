import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { communityRateLimit } from "../plugins/integration-auth.js";
import { notFound } from "../utils/api-error.js";

const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("VIEW") }).strict(),
  z.object({ type: z.literal("CONTACT"), contactType: z.enum(["SOURCE", "PHONE", "ZALO", "FACEBOOK"]) }).strict(),
]);

/** Operational counters via structured logs, no tracking identifier or raw contact. */
export async function communityEventRoutes(app: FastifyInstance): Promise<void> {
  app.post("/community-listings/:id/events", { bodyLimit: 1024 }, async (request, reply) => {
    if (!env.COMMUNITY_LISTINGS_PUBLIC_ENABLED) throw notFound();
    await communityRateLimit(`rl:community:events:${request.ip}`, 120, 60, reply);
    const event = EventSchema.parse(request.body);
    const { id } = request.params as { id: string };
    const listing = await prisma.communityListing.findFirst({ where: {
      id, publicationStatus: "PUBLISHED", sourceStatus: { not: "DELETED" }, anonymizedAt: null, source: { publicEnabled: true },
    }, select: { id: true, sourceId: true, areaCode: true } });
    if (!listing) throw notFound();
    request.log.info({ event: `community.${event.type.toLowerCase()}`, listingId: id, sourceId: listing.sourceId,
      areaCode: listing.areaCode, ...(event.type === "CONTACT" ? { contactType: event.contactType } : {}) }, "Community engagement");
    return reply.code(204).send();
  });
}
