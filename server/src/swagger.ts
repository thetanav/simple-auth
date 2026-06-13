import swaggerJsdoc from "swagger-jsdoc";
import env from "./zod/env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "simple-auth",
      version: "1.0.0",
      description:
        "Simple auth server: email/password, per-device sessions, JWT access & refresh",
    },
    servers: [
      { url: `http://localhost:${env.PORT}`, description: "Development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        SignupInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        SigninInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        AccessTokenResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
          },
        },
        SessionResponse: {
          type: "object",
          properties: {
            loggedIn: { type: "boolean" },
            userId: { type: "string" },
            email: { type: "string" },
            sessionId: { type: "string" },
          },
        },
        MessageResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        ForgotPasswordInput: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
        },
        ForgotPasswordResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            resetToken: { type: "string" },
          },
        },
        ResetPasswordInput: {
          type: "object",
          required: ["resetToken", "newPassword"],
          properties: {
            resetToken: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Welcome message",
          responses: {
            "200": { description: "Welcome message" },
          },
        },
      },
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": {
              description: "Health check OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      ts: {
                        type: "string",
                        format: "date-time",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/db-health": {
        get: {
          tags: ["Health"],
          summary: "Database health check",
          responses: {
            "200": {
              description: "Database health check OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      ts: {
                        type: "string",
                        format: "date-time",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/signup-with-email": {
        post: {
          tags: ["Auth"],
          summary: "Sign up with email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SignupInput",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User created successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AccessTokenResponse",
                  },
                },
              },
            },
            "400": {
              description: "Validation error or user already exists",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/signin-with-email": {
        post: {
          tags: ["Auth"],
          summary: "Sign in with email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SigninInput",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Signed in successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AccessTokenResponse",
                  },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Refresh access token using refresh token cookie",
          responses: {
            "200": {
              description: "Token refreshed successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AccessTokenResponse",
                  },
                },
              },
            },
            "401": {
              description: "Invalid or expired refresh token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/session": {
        get: {
          tags: ["Auth"],
          summary: "Check if user is logged in and get session info",
          responses: {
            "200": {
              description: "Session info",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SessionResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Log out current session",
          responses: {
            "200": {
              description: "Logged out successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MessageResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/logout-session": {
        get: {
          tags: ["Auth"],
          summary: "Log out a specific session by session ID",
          parameters: [
            {
              name: "sessionId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Session logged out",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MessageResponse",
                  },
                },
              },
            },
            "400": {
              description: "Session ID is required",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Request a password reset token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ForgotPasswordInput",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Reset token sent",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ForgotPasswordResponse",
                  },
                },
              },
            },
            "404": {
              description: "User not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Reset password using reset token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResetPasswordInput",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Password reset successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/MessageResponse",
                  },
                },
              },
            },
            "404": {
              description: "Invalid reset token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
