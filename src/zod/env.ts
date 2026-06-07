import { z } from "zod";

const envSchema = z.object({
  // Enforce specific environment strings
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Automatically convert string to number and fall back to 3000
  PORT: z.coerce.number().default(3000),

  // Enforce a required string with custom formatting
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),

  // Auth secrets
  REFRESH_TOKEN_SECRET: z
    .string()
    .describe("REFRESH_TOKEN_SECRET must be a valid string"),
  ACCESS_TOKEN_SECRET: z
    .string()
    .describe("ACCESS_TOKEN_SECRET must be a valid string"),
});

// Validate process.env against the schema
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:", result.error.format());
  process.exit(1);
}

// Export the typesafe, validated environment data
const env = result.data;
export default env;
