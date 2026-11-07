import { test, expect } from "@playwright/test";
import { widgetHtml } from "../../src/lib/widget.generated";
test("MCP Apps iframe bridge shows creations, scores and clears hidden selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((html) => {
    const calls: string[] = [];
    (window as any).widgetCalls = calls;
    const score = {
      overall: 70,
      dimensions: Object.fromEntries(
        ["virality", "clarity", "idea", "curiosity", "emotion"].map((p) => [
          p,
          {
            score: 70,
            observation: "One visible focal subject.",
            fix: "Simplify competing background details.",
          },
        ]),
      ),
    };
    window.addEventListener("message", (event) => {
      const m = event.data;
      if (!m || m.jsonrpc !== "2.0") return;
      if (m.method === "ui/notifications/size-changed") {
        const frame = document.querySelector("#mcp-test") as HTMLIFrameElement;
        if (frame)
          frame.style.height = Math.max(1000, m.params.height + 30) + "px";
        return;
      }
      if (m.id === undefined) return;
      let result: any;
      if (m.method === "ui/initialize")
        result = {
          protocolVersion: m.params.protocolVersion,
          hostInfo: { name: "Test MCP host", version: "1" },
          hostCapabilities: { serverTools: {} },
          hostContext: { theme: "dark" },
        };
      else if (m.method === "tools/call") {
        calls.push(m.params.name);
        const c = {
          id: "11111111-1111-4111-8111-111111111111",
          title: "I spent 30 days offline",
          status: "ready",
          score,
        };
        let data: any = {};
        if (m.params.name === "list_creations") data = { creations: [c] };
        if (m.params.name === "get_creation") data = { creation: c };
        if (m.params.name === "list_profiles")
          data = {
            profiles: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                name: "Creator reference",
              },
            ],
            kind: "persona",
          };
        if (m.params.name === "get_profile")
          data = { profile: { name: "Creator reference" }, pictures: [] };
        if (m.params.name === "get_fix_prompt")
          data = {
            prompt: "Edit the original thumbnail. Simplify background details.",
          };
        if (m.params.name === "create_fix_plan")
          data = {
            kind: "blocked",
            reason:
              "Add factual context and vision critique before an API fix.",
          };
        result = {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
        };
      } else result = {};
      (event.source as Window)?.postMessage(
        { jsonrpc: "2.0", id: m.id, result },
        "*",
      );
    });
    document.body.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.id = "mcp-test";
    iframe.style.cssText = "width:100%;height:1500px;border:0";
    iframe.srcdoc = html;
    document.body.append(iframe);
  }, widgetHtml);
  const widget = page.frameLocator("#mcp-test");
  await expect(widget.getByRole("status")).toContainText("Connected.");
  await widget.getByRole("button", { name: "My creations" }).click();
  await widget
    .getByRole("button", { name: "I spent 30 days offline ready" })
    .click();
  await expect(
    widget.getByRole("heading", { name: "Pixel score · 70/100" }),
  ).toBeVisible();
  await widget.getByRole("button", { name: "Fix prompt for ChatGPT" }).click();
  await expect(widget.getByLabel("Copyable improvement prompt")).toHaveValue(
    /Simplify/,
  );
  await widget
    .getByRole("button", { name: "Fix with my API", exact: true })
    .click();
  await expect(widget.getByRole("status")).toHaveText(
    "Add factual context and vision critique before an API fix.",
  );
  await page.screenshot({
    path: "evidence/openpikzels-mcp-widget.png",
    fullPage: true,
  });
  await widget.getByRole("button", { name: "Personas", exact: true }).click();
  await widget.getByRole("button", { name: "Resize to vertical" }).click();
  await expect(widget.getByRole("status")).toHaveText(
    "Choose a thumbnail first.",
  );
  expect(await page.evaluate(() => (window as any).widgetCalls)).not.toContain(
    "resize_thumbnail",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await widget.locator("body").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-mcp-widget-mobile.png",
    fullPage: true,
  });
});
