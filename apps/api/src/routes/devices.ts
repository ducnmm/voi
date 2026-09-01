import type { FastifyInstance } from "fastify";
import {
  RegisterPushDeviceSchema,
  UnregisterPushDeviceSchema
} from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { conflict, notFound } from "../utils/api-error.js";

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

    const existing = await prisma.pushDevice.findUnique({
      where: { deviceToken: body.deviceToken },
      select: { id: true, userId: true, disabledAt: true }
    });

    if (existing && existing.userId !== userId && existing.disabledAt == null) {
      throw conflict("This device is already registered to another account");
    }

    const device = existing
      ? await prisma.pushDevice.update({
          where: { id: existing.id },
          data: {
            userId,
            platform: body.platform,
            appVersion: body.appVersion,
            disabledAt: null
          }
        })
      : await prisma.pushDevice.create({
          data: {
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

  app.post(
    "/devices/unregister",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const body = UnregisterPushDeviceSchema.parse(request.body);
      await prisma.pushDevice.updateMany({
        where: { deviceToken: body.deviceToken, userId },
        data: { disabledAt: new Date() }
      });
      return { ok: true };
    }
  );

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
