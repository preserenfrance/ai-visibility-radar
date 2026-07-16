import { createHmac, timingSafeEqual } from "node:crypto";

type ReportContextTokenBase = {
  version: 1;
  expiresAt: number;
};

export type ReportContextTokenPayload =
  | (ReportContextTokenBase & {
      type: "brand";
      brandId: string;
    })
  | (ReportContextTokenBase & {
      type: "scan";
      brandId: string;
      scanId: string;
    });

export type ReportContextTokenInput =
  | {
      type: "brand";
      brandId: string;
    }
  | {
      type: "scan";
      brandId: string;
      scanId: string;
    };

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createReportContextToken(
  input: ReportContextTokenInput,
  ttlMs = DEFAULT_TTL_MS,
) {
  const payload: ReportContextTokenPayload = {
    ...input,
    version: 1,
    expiresAt: Date.now() + ttlMs,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${payloadSegment}.${signPayload(payloadSegment)}`;
}

export function verifyReportContextToken(
  token: string,
): ReportContextTokenPayload | null {
  const [payloadSegment, signature] = token.split(".");
  if (!payloadSegment || !signature) return null;

  const expected = signPayload(payloadSegment);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as Partial<ReportContextTokenPayload>;
    if (!isValidPayload(parsed)) return null;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidPayload(
  value: Partial<ReportContextTokenPayload>,
): value is ReportContextTokenPayload {
  if (value.version !== 1) return false;
  if (typeof value.expiresAt !== "number") return false;
  if (typeof value.brandId !== "string" || !value.brandId) return false;
  if (value.type === "brand") return true;
  return value.type === "scan" && typeof value.scanId === "string";
}

function signPayload(payloadSegment: string) {
  return createHmac("sha256", reportContextSecret())
    .update(payloadSegment)
    .digest("base64url");
}

function reportContextSecret() {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DATABASE_URL ??
    "ai-radar-dev-secret"
  );
}
