declare module "robots-parser" {
  export type RobotsParser = {
    isAllowed(url: string, userAgent?: string): boolean;
    isDisallowed(url: string, userAgent?: string): boolean;
    getCrawlDelay(userAgent?: string): number | null;
    getSitemaps(): string[];
    getPreferredHost(): string | null;
  };

  export default function robotsParser(robotsUrl: string, robotsTxt: string): RobotsParser;
}
