import { describe, it, expect } from "vitest";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { existsSync } from "node:fs";

describe("local profile name transactions", () => {
  it.skipIf(!existsSync(chromium.executablePath()))("serializes concurrent creates and renames against IndexedDB", async () => {
    const bundle = await build({ stdin: { contents: `import { localCreateProfile, localRenameProfile, localAll } from './src/lib/local-db'; window.profileDb = { localCreateProfile, localRenameProfile, localAll };`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "iife", alias: { "@": `${process.cwd()}/src` } });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("http://local.test/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
      await page.goto("http://local.test/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const result = await page.evaluate(async () => {
        const db = (window as any).profileDb;
        const profile = (id: string, name: string) => ({ id, name, created_at: '2026-01-01' });
        const creates = await Promise.allSettled([db.localCreateProfile('persona', profile('1', '  Shared ')), db.localCreateProfile('persona', profile('2', 'sHaReD'))]);
        await db.localCreateProfile('persona', profile('3', 'Another'));
        const existing = await db.localAll('personas');
        const renames = await Promise.allSettled([db.localRenameProfile('persona', existing[0].id, 'Target'), db.localRenameProfile('persona', '3', ' target ')]);
        const personas = await db.localAll('personas');
        await db.localCreateProfile('style', profile('4', 'target'));
        return { creates: creates.map(x => x.status), renames: renames.map(x => x.status), personas, styles: await db.localAll('styles') };
      });
      expect(result.creates.sort()).toEqual(["fulfilled", "rejected"]);
      expect(result.renames.sort()).toEqual(["fulfilled", "rejected"]);
      expect(result.personas).toHaveLength(2);
      expect(result.personas.filter((p: any) => p.name.toLowerCase() === 'target')).toHaveLength(1);
      expect(result.styles[0].name).toBe('target');
    } finally { await browser.close(); }
  });
});
