import jwt from "jsonwebtoken";
import type { Env } from "../config.js";

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_EXPIRES = "7d";

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">, secret: string, expires = DEFAULT_EXPIRES): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email },
    secret,
    { expiresIn: expires }
  );
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
