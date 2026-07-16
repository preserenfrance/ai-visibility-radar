import { getConfig } from "@ai-radar/config";
import {
  createReportContextToken,
  type ReportContextTokenInput,
} from "@/lib/report-context-token";

type ChatGptReportInput =
  | (ReportContextTokenInput & {
      type: "brand";
      brandName: string;
    })
  | (ReportContextTokenInput & {
      type: "scan";
      brandName: string;
    });

export function chatGptReportUrl(input: ChatGptReportInput) {
  const token = createReportContextToken(input);
  const contextUrl = new URL(
    `/api/public/report-context/${token}`,
    getConfig().NEXT_PUBLIC_APP_URL,
  ).toString();
  const prompt = buildChatGptPrompt(input, contextUrl);
  return `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
}

export function safeChatGptReportUrl(input: ChatGptReportInput) {
  try {
    return chatGptReportUrl(input);
  } catch (error) {
    console.error("ChatGPT report URL could not be created", error);
    return null;
  }
}

function buildChatGptPrompt(input: ChatGptReportInput, contextUrl: string) {
  const reportType =
    input.type === "scan" ? "latest scan context" : "brand report context";

  return [
    `Open and read this AI visibility ${reportType} for ${input.brandName}:`,
    contextUrl,
    "",
    "Analyze it as an AI visibility strategist. Identify:",
    "1. why the visibility score is high or low,",
    "2. which prompts and competitors matter most,",
    "3. citation and content gaps,",
    "4. a prioritized 30-day action plan.",
    "",
    "Use the linked context as evidence and be specific. If you cannot open the URL, ask me to paste the context.",
  ].join("\n");
}
