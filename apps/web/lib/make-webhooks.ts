import { getConfig } from "@ai-radar/config";

type RegisteredUserWebhookInput = {
  source: "signup" | "api_signup" | "free_audit";
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    marketingEmailConsent: boolean;
    scanEmailConsent: boolean;
  };
  organization?: {
    id: string;
    name: string;
    plan: string;
  } | null;
};

export async function triggerUserRegisteredWebhook(
  input: RegisteredUserWebhookInput,
) {
  const config = getConfig();
  if (!config.MAKE_USER_REGISTERED_WEBHOOK_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(config.MAKE_USER_REGISTERED_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.MAKE_WEBHOOK_SECRET
          ? { "x-llmvisio-webhook-secret": config.MAKE_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        event: "user.registered",
        source: input.source,
        occurredAt: new Date().toISOString(),
        user: {
          id: input.user.id,
          email: input.user.email,
          name: input.user.name,
          createdAt: input.user.createdAt.toISOString(),
          marketingEmailConsent: input.user.marketingEmailConsent,
          scanEmailConsent: input.user.scanEmailConsent,
        },
        organization: input.organization
          ? {
              id: input.organization.id,
              name: input.organization.name,
              plan: input.organization.plan,
            }
          : null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("Make user registered webhook failed", {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    console.warn("Make user registered webhook failed", error);
  } finally {
    clearTimeout(timeout);
  }
}
