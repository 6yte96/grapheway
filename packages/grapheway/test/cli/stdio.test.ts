import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { runStdioServer } from "../../src/cli/stdio.ts";
import { createGrapheway } from "../../src/web/handler.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Stdio Site",
  url: "https://stdio.test",
  summary: "A site served over stdio MCP.",
  sections: [{ title: "Docs", items: [{ title: "Start", url: "/start" }] }],
};

describe("runStdioServer", () => {
  test("answers initialize and tools/list over newline-delimited JSON", async () => {
    const agent = createGrapheway(config);
    const input = new PassThrough();
    const output = new PassThrough();
    const error = new PassThrough();
    let raw = "";
    output.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
    });

    const done = runStdioServer(agent, { input, output, error });
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      })}\n`,
    );
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
    input.end();
    await done;

    const responses = raw
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(responses).toHaveLength(2);

    const init = responses[0] as {
      result: { serverInfo: { name: string }; instructions: string };
    };
    expect(init.result.serverInfo.name).toBe("grapheway");
    expect(init.result.instructions).toContain("npx grapheway init");

    const tools = responses[1] as { result: { tools: Array<{ name: string }> } };
    expect(tools.result.tools.map((t) => t.name)).toContain("graph_search");
  });

  test("returns a JSON-RPC parse error for invalid input", async () => {
    const agent = createGrapheway(config);
    const input = new PassThrough();
    const output = new PassThrough();
    const error = new PassThrough();
    let raw = "";
    output.on("data", (chunk: Buffer) => {
      raw += chunk.toString();
    });

    const done = runStdioServer(agent, { input, output, error });
    input.write("not json\n");
    input.end();
    await done;

    const response = JSON.parse(raw.trim()) as { error: { code: number } };
    expect(response.error.code).toBe(-32700);
  });
});
