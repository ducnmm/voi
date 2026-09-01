import { ZodError } from "zod";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Authentication required"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You do not have access to this resource"): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "Resource not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function notImplemented(message = "Not implemented"): ApiError {
  return new ApiError(501, "NOT_IMPLEMENTED", message);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, "CONFLICT", message, details);
}

export function tooManyRequests(message = "Too many requests"): ApiError {
  return new ApiError(429, "RATE_LIMITED", message);
}

export function handleApiError(
  error: FastifyError | ApiError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    request.log.error({ err: error }, error.message);
  }
  reply.code(statusCode).send({
    error: {
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "Unexpected server error" : error.message
    }
  });
}
