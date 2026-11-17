#!/usr/bin/env node
// Trusted operator CLI. Never put integration tokens in command arguments/logs.
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
import { Prisma } from "@prisma/client";
import { prisma } from "../dist/db/prisma.js";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries([
    "actor", "id", "client", "source", "name", "code", "label", "file", "out", "days", "reason", "status",
  ].map((name) => [name, { type: "string" }])),
});
const command = positionals[0] ?? "help";
function required(name) {
  const value = args[name]?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}
function actor() { return required("actor"); }
async function audit(tx, action, targetType, targetId, details = {}) {
  await tx.communityAuditLog.create({ data: { actor: actor(), action, targetType, targetId, details } });
}
function info(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

const help = `Community administration (run from apps/api, after build)
  area:upsert     --code CODE --label LABEL --actor NAME
  source:upsert   --file source.json --actor NAME
  source:disable --id SOURCE_ID --actor NAME
  client:create  --name NAME --actor NAME
  client:grant   --client CLIENT_ID --source SOURCE_ID --actor NAME
  client:ungrant --client CLIENT_ID --source SOURCE_ID --actor NAME
  client:disable --id CLIENT_ID --actor NAME
  key:issue      --client CLIENT_ID --out /secure/new-key-file [--days 90] --actor NAME
  key:revoke     --id KEY_ID --actor NAME
  list           (safe area/source/client/credential inventory, no tokens)
  reports:list   [--status OPEN|RESOLVED|DISMISSED]
  report:resolve --id REPORT_ID --reason REASON --actor NAME
  listing:suppress --id LISTING_ID --reason REASON --actor NAME
  listing:restore  --id LISTING_ID --reason REASON --actor NAME
  retention      --actor NAME

source.json: {"id":"pilot-source","externalGroupId":"12345","name":"Group name",
  "url":"https://www.facebook.com/groups/12345/","ingestEnabled":true,"publicEnabled":false}
New keys are written once to a new mode-0600 file, never stdout. Import into Muse's
secret store, then remove the file. Keep an existing key active during rotation,
verify the new key, then revoke the old key by key ID. Database access is the CLI's
trust boundary; use an audited operator account, not the bot's credential.
`;

try {
  if (command === "help") {
    process.stdout.write(help);
  } else if (command === "area:upsert") {
    const code = required("code"), label = required("label");
    if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(code) || label.length > 120) throw new Error("Invalid area code/label");
    info(await prisma.$transaction(async (tx) => {
      const area = await tx.communityArea.upsert({ where: { code }, create: { code, label }, update: { label, enabled: true } });
      await audit(tx, command, "area", code);
      return area;
    }));
  } else if (command === "source:upsert") {
    const source = JSON.parse(await readFile(required("file"), "utf8"));
    if (typeof source.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(source.id)
      || typeof source.externalGroupId !== "string" || !/^[0-9]{1,40}$/.test(source.externalGroupId)
      || typeof source.name !== "string" || !source.name.trim() || source.name.length > 200
      || typeof source.ingestEnabled !== "boolean" || typeof source.publicEnabled !== "boolean") {
      throw new Error("Invalid source fields; explicit ingestEnabled/publicEnabled booleans required");
    }
    const url = new URL(source.url);
    if (url.protocol !== "https:" || !["www.facebook.com", "facebook.com", "m.facebook.com"].includes(url.hostname)
      || url.username || url.password || url.port
      || url.pathname.replace(/\/$/, "") !== `/groups/${source.externalGroupId}`) {
      throw new Error("Source URL must identify the configured Facebook group over HTTPS");
    }
    const data = {
      platform: "FACEBOOK", externalGroupId: source.externalGroupId, name: source.name.trim(),
      url: `https://www.facebook.com/groups/${source.externalGroupId}/`,
      ingestEnabled: source.ingestEnabled, publicEnabled: source.publicEnabled,
    };
    info(await prisma.$transaction(async (tx) => {
      const existing = await tx.communitySource.findUnique({ where: { id: source.id } });
      if (existing && existing.externalGroupId !== data.externalGroupId) throw new Error("A source's group identity is immutable; create another source ID");
      const row = await tx.communitySource.upsert({ where: { id: source.id }, create: { id: source.id, ...data }, update: data });
      await audit(tx, command, "source", source.id, { ingestEnabled: data.ingestEnabled, publicEnabled: data.publicEnabled });
      return row;
    }));
  } else if (command === "source:disable") {
    const id = required("id");
    await prisma.$transaction(async (tx) => {
      await tx.communitySource.update({ where: { id }, data: { ingestEnabled: false, publicEnabled: false } });
      await audit(tx, command, "source", id);
    });
    info({ id, disabled: true });
  } else if (command === "client:create") {
    const name = required("name");
    if (name.length > 120) throw new Error("Name too long");
    info(await prisma.$transaction(async (tx) => {
      const client = await tx.integrationClient.create({ data: { name, scopes: ["community:read", "community:write"], sourceIds: [] } });
      await audit(tx, command, "client", client.id);
      return client;
    }));
  } else if (command === "client:grant" || command === "client:ungrant") {
    const clientId = required("client"), sourceId = required("source");
    info(await prisma.$transaction(async (tx) => {
      await tx.communitySource.findUniqueOrThrow({ where: { id: sourceId } });
      const current = await tx.integrationClient.findUniqueOrThrow({ where: { id: clientId } });
      const sourceIds = command === "client:grant" ? [...new Set([...current.sourceIds, sourceId])] : current.sourceIds.filter((id) => id !== sourceId);
      const client = await tx.integrationClient.update({ where: { id: clientId }, data: { sourceIds } });
      await audit(tx, command, "client", clientId, { sourceId });
      return client;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } else if (command === "client:disable") {
    const id = required("id");
    await prisma.$transaction(async (tx) => {
      await tx.integrationClient.update({ where: { id }, data: { disabledAt: new Date() } });
      await audit(tx, command, "client", id);
    });
    info({ id, disabled: true });
  } else if (command === "key:issue") {
    const clientId = required("client"), out = required("out");
    actor();
    const days = Number(args.days ?? 90);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("--days must be 1..365");
    const client = await prisma.integrationClient.findUniqueOrThrow({ where: { id: clientId } });
    if (client.disabledAt) throw new Error("Client is disabled");
    const keyId = randomBytes(12).toString("hex");
    const token = `voi_int.${keyId}.${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + days * 86400000);
    const handle = await open(out, "wx", 0o600);
    try {
      await handle.writeFile(`${token}\n`);
      await handle.sync();
      await prisma.$transaction(async (tx) => {
        await tx.integrationCredential.create({ data: { clientId, keyId, tokenHash, expiresAt } });
        await audit(tx, command, "credential", keyId, { clientId, expiresAt: expiresAt.toISOString() });
      });
    } catch (error) {
      await unlink(out).catch(() => {});
      throw error;
    } finally { await handle.close(); }
    info({ keyId, clientId, expiresAt, secretFile: out });
  } else if (command === "key:revoke") {
    const keyId = required("id");
    await prisma.$transaction(async (tx) => {
      await tx.integrationCredential.update({ where: { keyId }, data: { revokedAt: new Date() } });
      await audit(tx, command, "credential", keyId);
    });
    info({ keyId, revoked: true });
  } else if (command === "list") {
    info({
      areas: await prisma.communityArea.findMany(),
      sources: await prisma.communitySource.findMany(),
      clients: await prisma.integrationClient.findMany({ include: { credentials: { select: { keyId: true, expiresAt: true, revokedAt: true } } } }),
    });
  } else if (command === "reports:list") {
    const status = args.status ?? "OPEN";
    if (!["OPEN", "RESOLVED", "DISMISSED"].includes(status)) throw new Error("Invalid report status");
    info(await prisma.communityListingReport.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100 }));
  } else if (command === "report:resolve") {
    const id = required("id"), reason = required("reason");
    await prisma.$transaction(async (tx) => {
      await tx.communityListingReport.update({ where: { id }, data: { status: "RESOLVED", resolutionNote: reason, resolvedAt: new Date() } });
      await audit(tx, command, "report", id, { reason });
    });
    info({ id, resolved: true });
  } else if (command === "listing:suppress" || command === "listing:restore") {
    const id = required("id"), reason = required("reason");
    await prisma.$transaction(async (tx) => {
      await tx.communityListing.update({ where: { id }, data: {
        publicationStatus: command === "listing:suppress" ? "SUPPRESSED" : "NEEDS_REVIEW",
        suppressionReason: command === "listing:suppress" ? reason : null,
        ...(command === "listing:restore" ? { sourceStatus: "UNKNOWN", anonymizedAt: null } : {}),
      } });
      await audit(tx, command, "listing", id, { reason });
    });
    info({ id, action: command, ...(command === "listing:restore" ? { next: "Muse must submit a newer complete observation before publication" } : {}) });
  } else if (command === "retention") {
    const { runCommunityRetention } = await import("../dist/services/community-retention.js");
    info(await runCommunityRetention(new Date(), actor()));
  } else {
    throw new Error(`Unknown command. Run community-admin.mjs help`);
  }
} catch (error) {
  // Prisma errors can echo input: expose only safe code for DB failures.
  process.stderr.write(`${error instanceof Prisma.PrismaClientKnownRequestError ? `Database operation failed (${error.code})` : error instanceof Prisma.PrismaClientValidationError ? "Invalid database operation" : error.message}\n`);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
