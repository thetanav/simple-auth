import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { JwtAuthPayload } from "../types/signup.js";

// Minimal typing for middleware request body augmentation
type AuthedRequest = Request & { body: Record<string, any> };

export const auth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as JwtAuthPayload | string;
    if (typeof decoded !== "string" && decoded.type === "access") {
      req.body.user = decoded;
      next();
    } else {
      return res.status(401).json({ message: "Invalid token type" });
    }
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
