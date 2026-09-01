import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.group.deleteMany({
    where: { id: "seed-group-tuesday-night" }
  });

  const host = await prisma.user.upsert({
    where: { email: "host@example.com" },
    update: {
      displayName: "Host"
    },
    create: {
      email: "host@example.com",
      displayName: "Host",
      defaultSkillLevel: "INTERMEDIATE"
    }
  });

  const group = await prisma.group.create({
    data: {
      id: "seed-group-tuesday-night",
      name: "Tuesday Night Badminton",
      description: "Weekly intermediate doubles session.",
      defaultVenueName: "Ky Hoa Badminton",
      defaultSkillLevel: "INTERMEDIATE",
      createdByUserId: host.id,
      members: {
        create: {
          userId: host.id,
          role: "HOST"
        }
      }
    }
  });

  const players = await Promise.all(
    ["An", "Binh", "Chi", "Duy", "Hai", "Linh", "Minh", "Tu", "Quan"].map(
      (displayName, index) =>
        prisma.user.upsert({
          where: { email: `${displayName.toLowerCase()}@example.com` },
          update: { displayName },
          create: {
            email: `${displayName.toLowerCase()}@example.com`,
            displayName,
            defaultSkillLevel: index % 3 === 0 ? "ADVANCED" : "INTERMEDIATE"
          }
        })
    )
  );

  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 3);
  startsAt.setHours(19, 0, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setHours(21, 0, 0, 0);

  const session = await prisma.session.create({
    data: {
      id: "seed-session-tuesday-night",
      groupId: group.id,
      hostUserId: host.id,
      title: "Tuesday Night Badminton",
      startsAt,
      endsAt,
      venueName: "Ky Hoa Badminton",
      courtCount: 2,
      maxPlayers: 12,
      feeTotalVnd: 240000,
      shuttlecockCostVnd: 60000,
      skillLevel: "INTERMEDIATE",
      costTrackingEnabled: true,
      courts: {
        create: [
          { label: "Court 1", sortOrder: 1 },
          { label: "Court 2", sortOrder: 2 }
        ]
      },
      invites: {
        create: {
          token: "seed-tuesday-night",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      }
    },
    include: {
      courts: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  const participants = await Promise.all(
    players.map((player, index) =>
      prisma.sessionParticipant.create({
        data: {
          sessionId: session.id,
          userId: player.id,
          rsvpStatus: index < 8 ? "JOINED" : "WAITLISTED",
          joinedAt: index < 8 ? new Date() : null,
          waitlistPosition: index < 8 ? null : index - 7,
          paymentStatus: index < 8 ? "UNPAID" : "NOT_REQUIRED"
        }
      })
    )
  );

  await prisma.lineupSlot.createMany({
    data: participants.slice(0, 8).map((participant, index) => ({
      sessionId: session.id,
      courtId: session.courts[index < 4 ? 0 : 1]!.id,
      participantId: participant.id,
      slotOrder: (index % 4) + 1
    }))
  });

  // Add the regular players as group members so the People directory has data.
  await prisma.groupMember.createMany({
    data: players.map((player) => ({
      groupId: group.id,
      userId: player.id,
      role: "MEMBER" as const
    })),
    skipDuplicates: true
  });

  // Group member with no RSVP yet — used by non-host Join-only E2E.
  const vy = await prisma.user.upsert({
    where: { email: "vy@example.com" },
    update: { displayName: "Vy" },
    create: {
      email: "vy@example.com",
      displayName: "Vy",
      defaultSkillLevel: "BEGINNER"
    }
  });
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: vy.id } },
    update: {},
    create: { groupId: group.id, userId: vy.id, role: "MEMBER" }
  });

  const pastStarts = new Date();
  pastStarts.setDate(pastStarts.getDate() - 7);
  pastStarts.setHours(19, 0, 0, 0);
  const pastEnds = new Date(pastStarts);
  pastEnds.setHours(21, 0, 0, 0);

  await prisma.session.create({
    data: {
      id: "seed-session-last-week",
      groupId: group.id,
      hostUserId: host.id,
      title: "Last Week Smash",
      startsAt: pastStarts,
      endsAt: pastEnds,
      venueName: "Ky Hoa Badminton",
      courtCount: 1,
      maxPlayers: 4,
      feeTotalVnd: 120000,
      shuttlecockCostVnd: 30000,
      skillLevel: "INTERMEDIATE",
      costTrackingEnabled: true,
      courts: {
        create: [{ label: "Court 1", sortOrder: 1 }]
      }
    }
  });

  const membersOnlyStarts = new Date();
  membersOnlyStarts.setDate(membersOnlyStarts.getDate() + 4);
  membersOnlyStarts.setHours(18, 0, 0, 0);
  const membersOnlyEnds = new Date(membersOnlyStarts);
  membersOnlyEnds.setHours(20, 0, 0, 0);

  await prisma.session.create({
    data: {
      id: "seed-session-group-only",
      groupId: group.id,
      hostUserId: host.id,
      title: "Members Only Smash",
      startsAt: membersOnlyStarts,
      endsAt: membersOnlyEnds,
      venueName: "Ky Hoa Badminton",
      courtCount: 1,
      maxPlayers: 8,
      skillLevel: "INTERMEDIATE",
      visibility: "GROUP_ONLY",
      courts: {
        create: [{ label: "Court 1", sortOrder: 1 }]
      },
      invites: {
        create: {
          token: "seed-group-only",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  await prisma.notification.create({
    data: {
      id: "seed-notification-reminder",
      userId: host.id,
      sessionId: session.id,
      type: "SESSION_REMINDER",
      deliveryStatus: "PENDING",
      scheduledFor: new Date()
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
