import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./../../generated/prisma/client.js";
import env from "../zod/env.js";

const adapter = new PrismaLibSql({ url: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
