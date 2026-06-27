import { env } from "./config/env.js";

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Voi API",
    version: "0.1.0",
    description:
      "Professional scheduling API for badminton groups, sessions, RSVP, lineups, payments, and notifications."
  },
  servers: [
    {
      url: `http://localhost:${env.API_PORT}/${env.API_VERSION}`,
      description: "Local development"
    }
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {}
            }
          }
        }
      },
      SkillLevel: {
        type: "string",
        enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "OPEN"]
      },
      RsvpStatus: {
        type: "string",
        enum: ["JOINED", "MAYBE", "DECLINED", "WAITLISTED", "CANCELLED"]
      },
      PaymentStatus: {
        type: "string",
        enum: ["NOT_REQUIRED", "UNPAID", "PAID"]
      }
    }
  },
  paths: {
    "/health": {
      get: {
        security: [],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy"
          }
        }
      }
    },
    "/auth/dev": {
      post: {
        security: [],
        summary: "Development login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  displayName: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Authenticated user and bearer token" },
          "400": { description: "Validation error" }
        }
      }
    },
    "/me": {
      get: {
        summary: "Current user",
        responses: {
          "200": { description: "Authenticated user" },
          "401": { description: "Authentication required" }
        }
      },
      patch: {
        summary: "Update current user profile",
        responses: {
          "200": { description: "Updated user profile" }
        }
      }
    },
    "/groups": {
      get: {
        summary: "List groups",
        responses: {
          "200": { description: "Groups for authenticated user" }
        }
      },
      post: {
        summary: "Create group",
        responses: {
          "201": { description: "Created group" }
        }
      }
    },
    "/groups/{groupId}": {
      get: {
        summary: "Group detail",
        parameters: [
          {
            name: "groupId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Group detail" },
          "404": { description: "Group not found" }
        }
      }
    },
    "/groups/{groupId}/sessions": {
      post: {
        summary: "Create session",
        parameters: [
          {
            name: "groupId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "201": { description: "Created session" }
        }
      }
    },
    "/groups/{groupId}/invites": {
      post: {
        summary: "Create group invite",
        responses: {
          "201": { description: "Created group invite" }
        }
      }
    },
    "/sessions/{sessionId}": {
      get: {
        security: [],
        summary: "Session detail",
        responses: {
          "200": { description: "Session detail" }
        }
      },
      patch: {
        summary: "Update session",
        responses: {
          "200": { description: "Updated session" }
        }
      }
    },
    "/sessions/{sessionId}/cancel": {
      post: {
        summary: "Cancel session",
        responses: {
          "200": { description: "Cancelled session" }
        }
      }
    },
    "/sessions/{sessionId}/rsvp": {
      post: {
        summary: "Update RSVP",
        responses: {
          "200": { description: "Updated session with effective RSVP state" }
        }
      }
    },
    "/sessions/{sessionId}/lineup": {
      put: {
        summary: "Replace court lineup",
        responses: {
          "200": { description: "Updated lineup" }
        }
      }
    },
    "/notifications": {
      get: {
        summary: "Notification records",
        responses: {
          "200": { description: "User notification records" }
        }
      }
    },
    "/notification-preferences": {
      get: {
        summary: "Notification preferences",
        responses: {
          "200": { description: "Current notification preferences" }
        }
      },
      put: {
        summary: "Update notification preferences",
        responses: {
          "200": { description: "Updated notification preferences" }
        }
      }
    },
    "/devices": {
      get: {
        summary: "List push devices",
        responses: {
          "200": { description: "Active push devices" }
        }
      },
      post: {
        summary: "Register push device",
        responses: {
          "201": { description: "Registered push device" }
        }
      }
    },
    "/devices/{deviceId}": {
      delete: {
        summary: "Disable push device",
        responses: {
          "200": { description: "Device disabled" }
        }
      }
    },
    "/invites/{token}/accept": {
      post: {
        summary: "Accept invite",
        responses: {
          "200": { description: "Invite accepted" }
        }
      }
    }
  }
} as const;
