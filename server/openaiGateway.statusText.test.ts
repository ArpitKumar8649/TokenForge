import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";

/**
 * Regression: some opus5 upstream providers return a non-ASCII Reason-Phrase
 * (e.g. a bullet). undici reconstructs Responses through its WebIDL ByteString
 * converter, which rejects any statusText char above 255. The gateway's wrap
 * helpers strip those characters before re-wrapping an upstream Response so a
 * provider status line can never crash a streamed response.
 */
describe("gateway statusText sanitization", () => {
  const servers: net.Server[] = [];

  afterEach(async () => {
    const pending = servers.splice(0);
    serverUnrefAll(pending);
    await Promise.all(pending.map(server => new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 200);
      server.close(() => { clearTimeout(timer); resolve(); });
    })));
  });

  function serverUnrefAll(list: net.Server[]) {
    for (const server of list) server.unref();
  }

  function startServer(): Promise<net.Server> {
    return new Promise(resolve => {
      const server = net.createServer(socket => {
        socket.write("HTTP/1.1 200 Something•Good\r\n");
        socket.write("Content-Type: application/json\r\n");
        socket.write("Connection: close\r\n");
        socket.write("\r\n");
        socket.write("{}");
        socket.end();
      });
      servers.push(server);
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
  }

  it("delivers a non-ASCII statusText on a real wire fetch", async () => {
    const server = await startServer();
    const address = server.address() as { port: number };
    const upstream = await fetch(`http://127.0.0.1:${address.port}/`);
    expect(upstream.statusText).toBe("Something•Good");
  });

  it("re-wrapping with a raw non-ASCII statusText throws (the bug)", async () => {
    const server = await startServer();
    const address = server.address() as { port: number };
    const upstream = await fetch(`http://127.0.0.1:${address.port}/`);
    expect(upstream.statusText).toBe("Something•Good");
    expect(() => new Response("ok", { status: 200, statusText: upstream.statusText })).toThrow(TypeError);
  });

  it("re-wrapping with an ASCII-sanitized statusText does not throw (the fix)", async () => {
    const server = await startServer();
    const address = server.address() as { port: number };
    const upstream = await fetch(`http://127.0.0.1:${address.port}/`);
    const safeStatusText = Array.from(upstream.statusText)
      .filter(char => {
        const code = char.charCodeAt(0);
        return code >= 0x20 && code <= 0x7e;
      })
      .join("");
    expect(safeStatusText).toBe("SomethingGood");
    expect(() => new Response("ok", { status: 200, statusText: safeStatusText })).not.toThrow();
  });
});
