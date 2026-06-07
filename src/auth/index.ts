import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { signinSchema, signupSchema } from "../zod/zod.types.js";
import { prisma } from "../lib/prisma.js";

interface JwtAuthPayload {
  userId: string;
  sessionId: string;
  type: string;
}

const authRouter = express.Router();

authRouter.post("/signup-with-email", async (req, res) => {
  try {
    const { email, password } = req.body;

    const validatedData = signupSchema.safeParse({
      email,
      password,
    });

    if (!validatedData.success) {
      return res.status(400).json({
        error: validatedData.error.message,
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.data.email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      validatedData.data.password,
      10
    );

    const userAgent = req.headers["user-agent"] ?? "";
    const ipAddress = req.ip ?? "";

    const { user, session } = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email: validatedData.data.email,
            password: hashedPassword,
          },
        });

        const session = await tx.session.create({
          data: {
            userId: user.id,
            userAgent,
            ipAddress,

            // Session lifetime
            expiresAt: new Date(
              Date.now() +
                30 * 24 * 60 * 60 * 1000
            ),
          },
        });

        return {
          user,
          session,
        };
      }
    );

    const accessToken = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        type: "access",
      },
      process.env.ACCESS_TOKEN_SECRET!,
      {
        expiresIn: "15m",
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        type: "refresh",
      },
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await prisma.token.create({
      data: {
        sessionId: session.id,
        token: hashedRefreshToken,

        expiresAt: new Date(
          Date.now() +
            7 * 24 * 60 * 60 * 1000
        ),
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      accessToken,
    });
  } catch (error) {
    console.error("[signup-with-email]", error);

    return res.status(500).json({
      error: "Its not you, its us",
    });
  }
});

authRouter.post("/signin-with-email", async (req, res) => {
    try {
      const { email, password } = req.body;
  
      const validatedData = signinSchema.safeParse({
        email,
        password,
      });
  
      if (!validatedData.success) {
        return res.status(400).json({
          error: validatedData.error.message,
        });
      }
  
      const user = await prisma.user.findUnique({
        where: {
          email: validatedData.data.email,
        },
      });
  
      if (!user) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }
  
      const isPasswordValid = await bcrypt.compare(
        validatedData.data.password,
        user.password
      );
  
      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }
  
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          ipAddress: req.ip ?? "",
          userAgent: req.headers["user-agent"] ?? "",
          expiresAt: new Date(
            Date.now() +
            30 * 24 * 60 * 60 * 1000
          ),
        },
      });
  
      const refreshToken = jwt.sign(
        {
          userId: user.id,
          sessionId: session.id,
          type: "refresh",
        },
        process.env.REFRESH_TOKEN_SECRET!,
        {
          expiresIn: "7d",
        }
      );
  
      const accessToken = jwt.sign(
        {
          userId: user.id,
          sessionId: session.id,
          type: "access",
        },
        process.env.ACCESS_TOKEN_SECRET!,
        {
          expiresIn: "15m",
        }
      );
  
      const hashedRefreshToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
  
      await prisma.token.create({
        data: {
          sessionId: session.id,
          token: hashedRefreshToken,
          expiresAt: new Date(
            Date.now() +
            7 * 24 * 60 * 60 * 1000
          ),
        },
      });
  
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge:
          7 * 24 * 60 * 60 * 1000,
      });
  
      return res.status(200).json({
        accessToken,
      });
  
    } catch (error) {
      console.error("[signin-with-email]", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });


authRouter.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.cookies as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(401).json({
        error: "Invalid refresh token",
      });
    }

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const token = await prisma.token.findFirst({
        where: {
            token: hashedRefreshToken,
        },
    });
    if (!token || token.expiresAt < new Date()) {
        return res.status(401).json({
            error: "Invalid refresh token",
        });
    }

    //check if session is expired or what
    const session = await prisma.session.findUnique({
        where: {
            id: token.sessionId,
        },
    });
    if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({
            error: "Invalid refresh token",
        });
    }

    const verified = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    );

    if (typeof verified === "string") {
      return res.status(401).json({
        error: "Invalid refresh token",
      });
    }

    const decoded = verified as JwtAuthPayload;
    if (decoded.type !== "refresh") {
      return res.status(401).json({
        error: "Invalid refresh token",
      });
    }

    
    const newAccessToken = jwt.sign({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        type: "access",
    }, process.env.ACCESS_TOKEN_SECRET!, {
        expiresIn: "15m",
    });

    //update the refresh token in the db
    const updatedRefreshToken = jwt.sign({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        type: "refresh",
    }, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: "7d",
    });

    res.cookie("refreshToken", updatedRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    const hashedUpdatedRefreshToken = crypto
      .createHash("sha256")
      .update(updatedRefreshToken)
      .digest("hex");

    await prisma.token.updateMany({
        where: {
            sessionId: decoded.sessionId,
        },
        data: {
            token: hashedUpdatedRefreshToken,
            expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            ),
        },
    });

    return res.status(200).json({
        accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("[refresh-token]", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.get("/session", async (req, res) => {
  try {
    const { refreshToken } = req.cookies as { refreshToken?: string };
    if (!refreshToken) {
      return res.json({ loggedIn: false });
    }

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const token = await prisma.token.findFirst({
      where: { token: hashedRefreshToken },
    });
    if (!token || token.expiresAt < new Date()) {
      return res.json({ loggedIn: false });
    }

    const session = await prisma.session.findUnique({
      where: { id: token.sessionId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!session || session.expiresAt < new Date()) {
      return res.json({ loggedIn: false });
    }

    try {
      const verified = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!
      );
      if (typeof verified === "string") {
        return res.json({ loggedIn: false });
      }
      const decoded = verified as JwtAuthPayload;
      if (decoded.type !== "refresh") {
        return res.json({ loggedIn: false });
      }
    } catch {
      return res.json({ loggedIn: false });
    }

    return res.json({
      loggedIn: true,
      userId: session.user.id,
      email: session.user.email,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[session]", error);
    return res.status(500).json({ loggedIn: false });
  }
});

authRouter.post("/logout", async (req, res) => {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
  };

  try {
    const { refreshToken } = req.cookies as { refreshToken?: string };

    if (!refreshToken) {
      res.clearCookie("refreshToken", cookieOpts);
      return res.status(200).json({ message: "Logged out successfully" });
    }

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const token = await prisma.token.findFirst({
      where: { token: hashedRefreshToken },
    });

    if (token) {
      await prisma.$transaction([
        prisma.token.deleteMany({ where: { sessionId: token.sessionId } }),
        prisma.session.delete({ where: { id: token.sessionId } }),
      ]);
    }

    res.clearCookie("refreshToken", cookieOpts);

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("[logout]", error);
    res.clearCookie("refreshToken", cookieOpts);
    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.get("/demo/db", async (_req, res) => {
  try {
    const [users, sessions, tokens] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          password: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.session.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true } },
          tokens: { select: { id: true } },
        },
      }),
      prisma.token.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          session: {
            select: {
              id: true,
              user: { select: { email: true } },
            },
          },
        },
      }),
    ]);

    return res.json({
      counts: {
        users: users.length,
        sessions: sessions.length,
        tokens: tokens.length,
      },
      users: users.map((u) => ({
        ...u,
        password: `${u.password.slice(0, 12)}… (${u.password.length} chars, bcrypt)`,
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        tokenCount: s.tokens.length,
        expired: s.expiresAt < new Date(),
      })),
      tokens: tokens.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        userEmail: t.session.user.email,
        token: `${t.token.slice(0, 16)}… (${t.token.length} chars, SHA-256)`,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        expired: t.expiresAt < new Date(),
      })),
    });
  } catch (error) {
    console.error("[demo/db]", error);
    return res.status(500).json({ error: "Failed to load database" });
  }
});

export default authRouter;