import { describe, expect, test } from "bun:test";
import { createGrapheway } from "../../src/web/index.ts";
import type { GraphewayConfig } from "../../src/core/index.ts";
import type { ActionAuditEvent } from "../../src/web/types.ts";

const config: GraphewayConfig = {
  name: "Controls",
  url: "https://example.com",
  actions: [
    { name: "echo", description: "Echo the arguments" },
    { name: "slow", description: "Sleep past the timeout" },
  ],
};

const echo = (args: Record<string, unknown>) => ({ echoed: args });

function call(
  agent: ReturnType<typeof createGrapheway>,
  options: {
    method?: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    contentLength?: number;
  },
) {
  return agent.handler({
    method: options.method ?? "GET",
    url: options.url,
    headers: {
      ...(options.headers ?? {}),
      ...(options.contentLength !== undefined
        ? { "content-length": String(options.contentLength) }
        : {}),
    },
    body: options.body,
  });
}

describe("authorize", () => {
  test("denies with 403 and the given reason", async () => {
    const agent = createGrapheway(config, {
      actions: { echo },
      authorize: (name) => (name === "echo" ? { allowed: false, reason: "No echo for you" } : true),
    });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: {} },
    });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body).error).toBe("No echo for you");
  });

  test("can require a specific status", async () => {
    const agent = createGrapheway(config, {
      actions: { echo },
      authorize: () => ({ allowed: false, status: 401, reason: "Sign in first" }),
    });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: {} },
    });
    expect(res.status).toBe(401);
  });

  test("allows when the decision is true", async () => {
    const agent = createGrapheway(config, { actions: { echo }, authorize: () => true });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: { a: 1 } },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).result).toEqual({ echoed: { a: 1 } });
  });
});

describe("rateLimit", () => {
  test("returns 429 with retry-after after the budget", async () => {
    const agent = createGrapheway(config, {
      actions: { echo },
      rateLimit: { windowMs: 60_000, max: 2 },
    });
    const headers = { "x-forwarded-for": "203.0.113.9" };
    expect((await call(agent, { url: "/agent", headers })).status).toBe(200);
    expect((await call(agent, { url: "/agent", headers })).status).toBe(200);
    const blocked = await call(agent, { url: "/agent", headers });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  test("separate keys have separate budgets", async () => {
    const agent = createGrapheway(config, {
      actions: { echo },
      rateLimit: { max: 1 },
    });
    expect(
      (await call(agent, { url: "/agent", headers: { "x-forwarded-for": "198.51.100.1" } })).status,
    ).toBe(200);
    expect(
      (await call(agent, { url: "/agent", headers: { "x-forwarded-for": "198.51.100.2" } })).status,
    ).toBe(200);
  });

  test("can be disabled", async () => {
    const agent = createGrapheway(config, { actions: { echo }, rateLimit: false });
    for (let i = 0; i < 5; i++) {
      expect((await call(agent, { url: "/agent" })).status).toBe(200);
    }
  });
});

describe("maxBodyBytes", () => {
  test("rejects an oversized body with 413", async () => {
    const agent = createGrapheway(config, { actions: { echo }, maxBodyBytes: 32 });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: { blob: "x".repeat(200) } },
    });
    expect(res.status).toBe(413);
  });

  test("honours a declared content-length", async () => {
    const agent = createGrapheway(config, { actions: { echo }, maxBodyBytes: 32 });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo" },
      contentLength: 1_000_000,
    });
    expect(res.status).toBe(413);
  });
});

describe("actionTimeoutMs", () => {
  test("returns 504 when an action overruns", async () => {
    const agent = createGrapheway(config, {
      actions: { slow: () => new Promise((resolve) => setTimeout(resolve, 50)) },
      actionTimeoutMs: 5,
    });
    const res = await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "slow", arguments: {} },
    });
    expect(res.status).toBe(504);
    expect(JSON.parse(res.body).error).toContain("timed out");
  });
});

describe("onAction audit", () => {
  test("records success and failure with annotations", async () => {
    const events: ActionAuditEvent[] = [];
    const agent = createGrapheway(config, {
      actions: { echo },
      onAction: (event) => {
        events.push(event);
      },
    });
    await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: { a: 1 } },
    });
    await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "echo", arguments: { a: 1 } },
    });
    await call(agent, {
      method: "POST",
      url: "/agent/action",
      body: { name: "missing", arguments: {} },
    });

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ action: "echo", ok: true, status: 200 });
    expect(events[1]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(events[2]).toMatchObject({ action: "missing", ok: false, status: 400 });
  });
});

describe("MCP tool errors", () => {
  test("a denied action is an isError result, not a protocol error", async () => {
    const agent = createGrapheway(config, {
      actions: { echo },
      authorize: () => ({ allowed: false, reason: "Nope" }),
    });
    const res = await call(agent, {
      method: "POST",
      url: "/mcp",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "echo", arguments: {} },
      },
    });
    const data = JSON.parse(res.body);
    expect(data.result.isError).toBe(true);
    expect(data.result.content[0].text).toBe("Nope");
  });
});
