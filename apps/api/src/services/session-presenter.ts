import { Prisma } from "@prisma/client";
import type { MatchResult } from "@prisma/client";
import { calculatePerPlayerCostVnd, calculateTotalCostVnd } from "./cost.js";

export function presentMatchResult(result: MatchResult) {
  return {
    id: result.id,
    label: result.label,
    scoreA: result.scoreA,
    scoreB: result.scoreB,
    createdAt: result.createdAt.toISOString()
  };
}

export const sessionInclude = Prisma.validator<Prisma.SessionInclude>()({
  group: true,
  invites: true,
  courts: {
    orderBy: { sortOrder: "asc" },
    include: {
      lineupSlots: {
        orderBy: { slotOrder: "asc" },
        include: {
          participant: {
            include: {
              user: true
            }
          }
        }
      }
    }
  },
  participants: {
    include: {
      user: true
    },
    orderBy: [
      { rsvpStatus: "asc" },
      { waitlistPosition: "asc" },
      { joinedAt: "asc" }
    ]
  }
});

/** Feed cards: group + invite token + RSVP counts. No lineup or participant users. */
export const sessionFeedInclude = Prisma.validator<Prisma.SessionInclude>()({
  group: { select: { id: true, name: true } },
  participants: { select: { rsvpStatus: true } }
});

export type SessionWithDetails = Prisma.SessionGetPayload<{
  include: typeof sessionInclude;
}>;

export type SessionFeedRow = Prisma.SessionGetPayload<{
  include: typeof sessionFeedInclude;
}>;

function presentSessionCounts(session: {
  maxPlayers: number;
  feeTotalVnd: number | null;
  shuttlecockCostVnd: number | null;
  feePerPlayerVnd: number | null;
  participants: { rsvpStatus: string }[];
}) {
  const joinedPlayerCount = session.participants.filter(
    (participant) => participant.rsvpStatus === "JOINED"
  ).length;

  return {
    joinedPlayerCount,
    waitlistCount: session.participants.filter(
      (participant) => participant.rsvpStatus === "WAITLISTED"
    ).length,
    availableSlots: Math.max(session.maxPlayers - joinedPlayerCount, 0),
    totalCostVnd: calculateTotalCostVnd({ ...session, joinedPlayerCount }),
    perPlayerCostVnd: calculatePerPlayerCostVnd({
      ...session,
      joinedPlayerCount
    })
  };
}

function presentSessionCore(session: {
  id: string;
  groupId: string;
  hostUserId: string;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueNote: string | null;
  courtCount: number;
  maxPlayers: number;
  feeTotalVnd: number | null;
  shuttlecockCostVnd: number | null;
  currency: string;
  skillLevel: SessionFeedRow["skillLevel"];
  visibility: SessionFeedRow["visibility"];
  costTrackingEnabled: boolean;
  feePerPlayerVnd: number | null;
  venueLat: number | null;
  venueLng: number | null;
  imageUrls: string[];
  status: SessionFeedRow["status"];
  createdAt: Date;
  updatedAt: Date;
  group: { id: string; name: string };
  invites?: { token: string }[];
  participants: { rsvpStatus: string }[];
}) {
  return {
    id: session.id,
    groupId: session.groupId,
    hostUserId: session.hostUserId,
    title: session.title,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    venueName: session.venueName,
    venueNote: session.venueNote,
    courtCount: session.courtCount,
    maxPlayers: session.maxPlayers,
    feeTotalVnd: session.feeTotalVnd,
    shuttlecockCostVnd: session.shuttlecockCostVnd,
    currency: session.currency,
    skillLevel: session.skillLevel,
    visibility: session.visibility,
    costTrackingEnabled: session.costTrackingEnabled,
    feePerPlayerVnd: session.feePerPlayerVnd,
    venueLat: session.venueLat,
    venueLng: session.venueLng,
    imageUrls: session.imageUrls,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    group: {
      id: session.group.id,
      name: session.group.name
    },
    inviteUrlToken: session.invites?.[0]?.token ?? null,
    summary: presentSessionCounts(session)
  };
}

export function presentSessionCard(session: SessionFeedRow) {
  return presentSessionCore(session);
}

export function presentSession(session: SessionWithDetails) {
  return {
    ...presentSessionCore(session),
    participants: session.participants.map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      rsvpStatus: participant.rsvpStatus,
      waitlistPosition: participant.waitlistPosition,
      paymentStatus: participant.paymentStatus,
      joinedAt: participant.joinedAt?.toISOString() ?? null,
      checkedInAt: participant.checkedInAt?.toISOString() ?? null,
      user: {
        id: participant.user.id,
        displayName: participant.user.displayName,
        avatarUrl: participant.user.avatarUrl,
        defaultSkillLevel: participant.user.defaultSkillLevel
      }
    })),
    courts: session.courts.map((court) => ({
      id: court.id,
      label: court.label,
      sortOrder: court.sortOrder,
      lineupSlots: court.lineupSlots.map((slot) => ({
        id: slot.id,
        participantId: slot.participantId,
        slotOrder: slot.slotOrder,
        user: {
          id: slot.participant.user.id,
          displayName: slot.participant.user.displayName,
          avatarUrl: slot.participant.user.avatarUrl
        }
      }))
    }))
  };
}
