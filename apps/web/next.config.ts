import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(dirname, "../../")
  },
  transpilePackages: [
    "@ai-radar/ai",
    "@ai-radar/config",
    "@ai-radar/crawler",
    "@ai-radar/db",
    "@ai-radar/email",
    "@ai-radar/parser",
    "@ai-radar/prompts",
    "@ai-radar/reports",
    "@ai-radar/scoring",
    "@ai-radar/shared",
    "@ai-radar/usage"
  ]
};

export default nextConfig;
