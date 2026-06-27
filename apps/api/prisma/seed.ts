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
      maxPlayers: 8,
      feeTotalVnd: 240000,
      shuttlecockCostVnd: 60000,
      skillLevel: "INTERMEDIATE",
      courts: {
        create: [
          { label: "Court 1", sortOrder: 1 },
          { label: "Court 2", sortOrder: 2 }
        ]
      },
      invites: {
        create: {
          token: "seed-tuesday-night"
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
