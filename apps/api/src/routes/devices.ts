import type { FastifyInstance } from "fastify";
import { RegisterPushDeviceSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { notFound } from "../utils/api-error.js";

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/devices", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const devices = await prisma.pushDevice.findMany({
      where: { userId, disabledAt: null },
      orderBy: { updatedAt: "desc" }
    });

    return {
      devices: devices.map((device) => ({
        id: device.id,
        platform: device.platform,
        appVersion: device.appVersion,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString()
      }))
    };
  });

  app.post("/devices", { preHandler: app.authenticate }, async (request, reply) => {
    const userId = getAuthenticatedUserId(request);
    const body = RegisterPushDeviceSchema.parse(request.body);

    const device = await prisma.pushDevice.upsert({
      where: { deviceToken: body.deviceToken },
      update: {
        userId,
        platform: body.platform,
        appVersion: body.appVersion,
        disabledAt: null
      },
      create: {
        userId,
        platform: body.platform,
        deviceToken: body.deviceToken,
        appVersion: body.appVersion
      }
    });

    return reply.code(201).send({
      device: {
        id: device.id,
        platform: device.platform,
        appVersion: device.appVersion,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString()
      }
    });
  });

  app.delete(
    "/devices/:deviceId",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { deviceId: string };
      const updated = await prisma.pushDevice.updateMany({
        where: {
          id: params.deviceId,
          userId
        },
        data: {
          disabledAt: new Date()
        }
      });

      if (updated.count === 0) {
        throw notFound("Device not found");
      }

      return { ok: true };
    }
  );
}
