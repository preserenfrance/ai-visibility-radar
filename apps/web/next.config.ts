import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(dirname, "../../"),
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": dirname
    };
    return config;
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
