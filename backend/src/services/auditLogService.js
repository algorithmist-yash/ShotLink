const AuditEvent = require("../models/AuditEvent");
const mongoose = require("mongoose");
const { extractClientIp, hashIp } = require("../utils/deviceInfo");

const DEFAULT_AUDIT_RETENTION_DAYS = 730;
const MAX_METADATA_STRING_LENGTH = 500;

function getAuditRetentionDays(env = process.env) {
  const configured = Number(env.AUDIT_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 30 && configured <= 3650
    ? configured
    : DEFAULT_AUDIT_RETENTION_DAYS;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, MAX_METADATA_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/password|secret|token|authorization|cookie/i.test(key))
        .slice(0, 30)
        .map(([key, item]) => [key, sanitizeMetadata(item, depth + 1)])
        .filter(([, item]) => item !== undefined)
    );
  }
  return undefined;
}

async function recordAuditEvent(
  req,
  {
    action,
    targetType,
    targetId = "",
    outcome = "success",
    metadata = {},
    workspaceId: explicitWorkspaceId,
    actorUserId: explicitActorUserId,
    sessionId: explicitSessionId,
  },
  { AuditEventModel = AuditEvent, env = process.env, logger = console, clock = Date.now } = {}
) {
  const workspaceId = explicitWorkspaceId || req.auth?.workspace?._id;
  const actorUserId = explicitActorUserId || req.auth?.user?._id;
  if (!workspaceId || !actorUserId) return false;
  if (!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(actorUserId)) {
    return false;
  }

  const retentionDays = getAuditRetentionDays(env);
  try {
    await AuditEventModel.create({
      workspaceId,
      actorUserId,
      sessionId: explicitSessionId || req.auth?.session?._id || null,
      action,
      targetType,
      targetId: String(targetId || ""),
      outcome,
      requestId: String(req.id || "").slice(0, 128),
      ipHash: hashIp(extractClientIp(req)),
      userAgent: String(req.get?.("user-agent") || "").slice(0, 500),
      metadata: sanitizeMetadata(metadata) || {},
      expiresAt: new Date(clock() + retentionDays * 24 * 60 * 60 * 1000),
    });
    return true;
  } catch (error) {
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "audit_event_write_failed",
        action,
        requestId: req.id || "",
        error: error.message,
      })
    );
    return false;
  }
}

module.exports = {
  DEFAULT_AUDIT_RETENTION_DAYS,
  getAuditRetentionDays,
  recordAuditEvent,
  sanitizeMetadata,
};
