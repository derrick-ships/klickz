import { test, expect } from "@playwright/test";
import { widgetHtml } from "../../src/lib/widget.generated";

// Drives the real widget through the MCP Apps postMessage bridge, as ChatGPT would.
test("MCP analysis card renders a tool result, copies the prompt, and runs One-Click Fix", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Describe your thumbnail", { exact: true })).toBeEnabled();
  await page.evaluate((html) => {
    const w = window as any;
    w.hostLog = { calls: [] as string[], context: [] as string[] };
    const dims = { virality: 58, clarity: 81, idea: 55, curiosity: 44, emotion: 72 } as Record<string, number>;
    const score = (overall: number) => ({
      overall,
      priority: "curiosity",
      title: "Petro dejó perder los Panamericanos",
      dimensions: Object.fromEntries(Object.entries(dims).map(([p, s]) => [p, { score: s, observation: `${p} observation`, strength: `${p} strength`, weakness: `${p} weakness`, fix: `${p} fix` }])),
    });
    const analysis = {
      creationId: "11111111-1111-4111-8111-111111111111",
      score: score(62),
      reviewer: "Claude",
      fix: { kind: "ready", token: "plan-token", prompt: "Edit the attached thumbnail.\n1. curiosity (44/100): curiosity fix" },
      previewUrl: null,
    };
    let frame: HTMLIFrameElement;
    const send = (msg: unknown) => frame.contentWindow!.postMessage(msg, "*");
    window.addEventListener("message", (event) => {
      const m = event.data;
      if (!m || m.jsonrpc !== "2.0") return;
      if (m.method === "ui/notifications/size-changed") { frame.style.height = Math.max(900, m.params.height + 30) + "px"; return; }
      if (m.method === "ui/notifications/initialized") {
        send({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { content: [{ type: "text", text: "scored" }], structuredContent: analysis } });
        return;
      }
      if (m.id === undefined) return;
      let result: any = {};
      if (m.method === "ui/initialize") result = { protocolVersion: m.params.protocolVersion, hostInfo: { name: "Test host", version: "1" }, hostCapabilities: { serverTools: {} }, hostContext: { theme: "dark" } };
      else if (m.method === "ui/update-model-context") w.hostLog.context.push(m.params.content?.[0]?.text || "");
      else if (m.method === "tools/call") {
        w.hostLog.calls.push(m.params.name + ":" + JSON.stringify(m.params.arguments));
        const data = { ...analysis, before: 62, after: 74, delta: 12, score: score(74), creation: { id: "22222222-2222-4222-8222-222222222222", title: "Petro dejó perder los Panamericanos" } };
        result = { content: [{ type: "text", text: "fixed" }], structuredContent: data };
      }
      send({ jsonrpc: "2.0", id: m.id, result });
    });
    document.body.replaceChildren();
    frame = document.createElement("iframe");
    frame.id = "mcp-test";
    frame.style.cssText = "width:100%;height:1500px;border:0";
    frame.srcdoc = html;
    document.body.append(frame);
  }, widgetHtml);

  const widget = page.frameLocator("#mcp-test");
  await expect(widget.getByRole("img", { name: "Overall score 62 out of 100" })).toBeVisible();
  await expect(widget.getByText("Fix first")).toBeVisible();
  for (const gone of ["Improved prompt to iterate", "Visual rubric", "Image review"]) {
    await expect(widget.getByText(gone)).toHaveCount(0);
  }
  await expect.poll(() => page.evaluate(() => (window as any).hostLog.context.join("\n"))).toContain("62");

  // Clipboard may be denied inside the test iframe; either outcome is acceptable.
  await widget.getByRole("button", { name: "Copy improved prompt" }).click();
  await expect
    .poll(async () => {
      const live = (await widget.locator("#live").textContent()) || "";
      const titles = await widget.locator("button.icon").evaluateAll((els) => els.map((e) => e.getAttribute("title")));
      return live === "Copied" || titles.includes("Press ⌘C");
    })
    .toBe(true);

  await widget.getByRole("button", { name: "One-Click Fix" }).click();
  await expect(widget.getByRole("img", { name: "Overall score 74 out of 100" })).toBeVisible();
  const calls: string[] = await page.evaluate(() => (window as any).hostLog.calls);
  expect(calls[0]).toMatch(/^one_click_fix:.*"planToken":"plan-token".*"rescore":true/);
  await page.screenshot({ path: "evidence/openpikzels-mcp-widget.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await widget.locator("body").evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "evidence/openpikzels-mcp-widget-mobile.png", fullPage: true });
});
