"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type McpTokenListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function McpTokenManager({
  initialTokens,
  endpoint,
}: {
  initialTokens: McpTokenListItem[];
  endpoint: string;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("MCP client");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeTokens = useMemo(
    () => tokens.filter((token) => !token.revokedAt),
    [tokens],
  );

  async function createToken() {
    setBusy(true);
    setCopied(false);
    try {
      const response = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Token creation failed");
      setCreatedToken(payload.token);
      setTokens((current) => [payload.record, ...current]);
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/mcp-tokens/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Token revocation failed");
      }
      setTokens((current) =>
        current.map((token) =>
          token.id === id
            ? { ...token, revokedAt: new Date().toISOString() }
            : token,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="MCP client"
          aria-label="Token name"
        />
        <Button type="button" onClick={createToken} disabled={busy}>
          <KeyRound className="h-4 w-4" />
          Create token
        </Button>
      </div>

      {createdToken && (
        <div className="rounded-md border bg-secondary/20 p-3">
          <div className="mb-2 text-sm font-medium">New token</div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <code className="overflow-auto rounded border bg-background px-3 py-2 text-xs">
              {createdToken}
            </code>
            <Button type="button" variant="outline" onClick={copyToken}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-secondary/20 p-3">
        <div className="mb-2 text-sm font-medium">Endpoint</div>
        <code className="block overflow-auto rounded border bg-background px-3 py-2 text-xs">
          {endpoint}
        </code>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Token</th>
              <th className="py-2 pr-3">Scopes</th>
              <th className="py-2 pr-3">Last used</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {activeTokens.length === 0 ? (
              <tr>
                <td colSpan={5} className="border-t py-4 text-muted-foreground">
                  No active MCP tokens.
                </td>
              </tr>
            ) : (
              activeTokens.map((token) => (
                <tr key={token.id}>
                  <td className="border-t py-3 pr-3 font-medium">
                    {token.name}
                  </td>
                  <td className="border-t py-3 pr-3 font-mono text-xs">
                    {token.tokenPrefix}
                  </td>
                  <td className="border-t py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="border-t py-3 pr-3 text-muted-foreground">
                    {token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleString("en-US")
                      : "-"}
                  </td>
                  <td className="border-t py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => revokeToken(token.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
