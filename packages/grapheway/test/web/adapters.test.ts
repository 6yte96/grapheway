import { describe, expect, test } from "bun:test";
import { createGrapheway } from "../../src/web/handler.ts";
import { toFetchHandler } from "../../src/web/adapters.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Adapter Test",
  url: "https://adapter.test",
  tagline: "Test the fetch adapter",
  summary: "A site used to verify the Web-standard Fetch adapter.",
  sections: [{ title: "Docs", items: [{ title: "Start", url: "/start" }] }],
};

function makeHandler() {
  const agent = createGrapheway(config);
  return toFetchHandler(agent.handler);
}

describe("toFetchHandler", () => {
  test("serves discovery from a Web Request", async () => {
    const res = await makeHandler()(new Request("https://adapter.test/.well-known/agent"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { protocol: string; name: string };
    expect(body.protocol).toBe("grapheway");
    expect(body.name).toBe("Adapter Test");
  });

  test("honours the rewritten-path header (Next.js middleware)", async () => {
    const req = new Request("https://adapter.test/api/grapheway", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-grapheway-path": "/mcp",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      }),
    });
    const res = await makeHandler()(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      result: { serverInfo: { name: string }; instructions: string };
    };
    expect(data.result.serverInfo.name).toBe("grapheway");
    expect(data.result.instructions).toContain("npx grapheway init");
  });

  test("strips a prefix when configured", async () => {
    const agent = createGrapheway(config);
    const handler = toFetchHandler(agent.handler, { prefix: "/gw" });
    const res = await handler(new Request("https://adapter.test/gw/.well-known/agent"));
    expect(res.status).toBe(200);
    expect((await res.json()) as { protocol: string }).toHaveProperty("protocol", "grapheway");
  });

  test("passes through actions as JSON", async () => {
    const agent = createGrapheway(config, {
      actions: {
        echo: async (args) => ({ echoed: args.value }),
      },
    });
    const handler = toFetchHandler(agent.handler);
    const res = await handler(
      new Request("https://adapter.test/agent/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "echo", arguments: { value: "hello" } }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; result: { echoed: string } };
    expect(data.ok).toBe(true);
    expect(data.result.echoed).toBe("hello");
  });
});
