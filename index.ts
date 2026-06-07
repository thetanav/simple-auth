import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import authRouter from "./src/auth/index.js";
import { prisma } from "./src/lib/prisma.js";
import helmet from "helmet";
import env from "./src/zod/env.js";
import { logger } from "./src/lib/logger.js";
import { swaggerSpec } from "./src/swagger.js";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = Number(env.PORT) || 3000;

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const tag = res.statusCode >= 500 ? "ERR" : res.statusCode >= 400 ? "WARN" : "OK";
    logger.info(`[${tag}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
  // store: ... , // Redis, Memcached, etc. See below.
});

app.use(limiter);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/", (req, res) => res.send("Welcome to simple-auth by tanavtwt!"));
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
app.get("/db-health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (error) {
    logger.error(["/db-health", error]);
    res.json({ ok: false, ts: new Date().toISOString() });
  }
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/auth", authRouter);

const server = app.listen(PORT, () => {
  logger.info(`Auth server → http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`\n  Port ${PORT} in use. Run: lsof -ti :${PORT} | xargs kill -9\n`);
  } else {
    logger.error(err);
  }
  process.exit(1);
});
