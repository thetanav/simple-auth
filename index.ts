import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./src/auth/index.js";
import { prisma } from "./src/lib/prisma.js";
import helmet from "helmet";
import env from "./src/zod/env.js";
import { logger } from "./src/lib/logger.js";

const app = express();
const PORT = Number(env.PORT) || 3000;

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const tag =
      res.statusCode >= 500 ? "ERR" : res.statusCode >= 400 ? "WARN" : "OK";
    logger.info(
      `[${tag}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`,
    );
  });
  next();
});

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
  } catch (err) {
    res.json({ ok: false, ts: new Date().toISOString() });
  }
});
app.use("/auth", authRouter);

const server = app.listen(PORT, () => {
  logger.info(`Auth server → http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(
      `\n  Port ${PORT} in use. Run: lsof -ti :${PORT} | xargs kill -9\n`,
    );
  } else {
    logger.error(err);
  }
  process.exit(1);
});
