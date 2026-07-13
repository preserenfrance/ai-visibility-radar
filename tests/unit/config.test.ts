import { describe, expect, it } from "vitest";
import { getConfig } from "@ai-radar/config";

describe("config", () => {
  it("uses the canonical app URL instead of Vercel deployment URLs in production", () => {
    const config = getConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://ai-visibility-radar.vercel.app",
    } as NodeJS.ProcessEnv);

    expect(config.NEXT_PUBLIC_APP_URL).toBe("https://www.llmvisio.com");
  });

  it("keeps custom production domains", () => {
    const config = getConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://www.llmvisio.com/",
    } as NodeJS.ProcessEnv);

    expect(config.NEXT_PUBLIC_APP_URL).toBe("https://www.llmvisio.com");
  });
});
