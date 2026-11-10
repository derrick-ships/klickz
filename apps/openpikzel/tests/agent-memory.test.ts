import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/validation";
import {
  forgetFact,
  recallFacts,
  rememberFact,
} from "../src/lib/agent-memory";

const fixtureKey = "sk-ant-test-0000FAKE";
const fixtureSecret = "sb_secret_test-0000FAKE";
const fixtureJwt =
  "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaXh0dXJlLXVzZXIifQ.sig-test-0000FAKE";
const fixtureHex = "0123456789abcdef0123456789abcdef";
const fixtureAssign = "API_KEY=fixture-0000FAKE";
const user = { id: "11111111-1111-4111-8111-111111111111" };

function memoryContext(scope = ["studio:agent"]) {
  const rows: any[] = [];
  const db = {
    from() {
      let action = "select",
        value: any,
        filters: Record<string, string> = {},
        pattern = "",
        limit = 20;
      const matched = () =>
        rows.filter((row) => {
          if (filters.id && row.id !== filters.id) return false;
          if (filters.user_id && row.user_id !== filters.user_id) return false;
          if (pattern)
            return String(row.fact).toLowerCase().includes(pattern);
          return true;
        });
      const chain: any = {
        insert: (v: any) => {
          action = "insert";
          value = v;
          return chain;
        },
        delete: () => {
          action = "delete";
          return chain;
        },
        select: () => chain,
        eq: (k: string, v: string) => {
          filters[k] = v;
          return chain;
        },
        ilike: (_k: string, v: string) => {
          pattern = v.replace(/%/g, "").toLowerCase();
          return chain;
        },
        order: () => chain,
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        single: async () => {
          if (action === "insert") {
            const row = {
              id: "ccccccc1-ccc1-4cc1-8cc1-ccccccccccc1",
              created_at: "2026-11-10T11:50:00.000Z",
              tags: [],
              ...value,
            };
            rows.push(row);
            return { data: row, error: null };
          }
          return { data: null, error: { message: "missing" } };
        },
        then: (resolve: any) => {
          if (action === "insert") {
            const row = {
              id: "ccccccc1-ccc1-4cc1-8cc1-ccccccccccc1",
              created_at: "2026-11-10T11:50:00.000Z",
              tags: [],
              ...value,
            };
            rows.push(row);
            return Promise.resolve({ data: [row], error: null }).then(resolve);
          }
          if (action === "delete") {
            const kept = rows.filter((row) => {
              if (filters.id && row.id === filters.id && filters.user_id === row.user_id)
                return false;
              return true;
            });
            const count = rows.length - kept.length;
            rows.splice(0, rows.length, ...kept);
            return Promise.resolve({ data: null, error: null, count }).then(resolve);
          }
          const data = matched()
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit)
            .map(({ id, fact, tags, created_at }) => ({ id, fact, tags, created_at }));
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { db, user, oauth: { scope }, rows };
}

async function captureLogs<T>(fn: () => Promise<T>) {
  const lines: string[] = [];
  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  for (const name of Object.keys(orig) as (keyof typeof orig)[])
    console[name] = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
  try {
    return { result: await fn(), lines };
  } finally {
    Object.assign(console, orig);
  }
}

function expectRejected(error: unknown, status: number) {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
}

describe("agent memory tools", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", "https://openpikzels.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("requires studio:agent and returns 403 when the scope is missing", async () => {
    const ctx = memoryContext(["studio:read"]);
    try {
      await rememberFact(ctx, { fact: "The usual hook is a close-up face.", agent: "default" });
      throw new Error("should have failed");
    } catch (error) {
      expectRejected(error, 403);
    }
    expect(ctx.rows).toHaveLength(0);
  });

  it("rejects secret-shaped facts with 400 and never stores them", async () => {
    const ctx = memoryContext();
    for (const fact of [
      `Key ${fixtureKey}`,
      `Token ${fixtureSecret}`,
      `Session ${fixtureJwt}`,
      `Id ${fixtureHex}`,
      fixtureAssign,
    ]) {
      try {
        await rememberFact(ctx, { fact, agent: "default" });
        throw new Error("should have failed");
      } catch (error) {
        expectRejected(error, 400);
        expect((error as AppError).message).not.toContain(fixtureKey);
        expect((error as AppError).message).not.toContain(fixtureSecret);
      }
    }
    expect(ctx.rows).toHaveLength(0);
  });

  it("stores a safe fact, recalls at most 20 newest matches, and forgets only that row", async () => {
    const ctx = memoryContext();
    const { result, lines } = await captureLogs(async () => {
      const saved = await rememberFact(ctx, {
        fact: "The usual hook is a close-up face.",
        tags: ["hook"],
        agent: "default",
        source: "companion",
      });
      const recalled = await recallFacts(ctx, { query: "hook" });
      const forgotten = await forgetFact(ctx, { id: saved.id });
      return { saved, recalled, forgotten };
    });
    expect(result.saved.fact).toBe("The usual hook is a close-up face.");
    expect(result.recalled.facts).toHaveLength(1);
    expect(result.recalled.facts[0]).toEqual(
      expect.objectContaining({
        id: result.saved.id,
        fact: "The usual hook is a close-up face.",
        tags: ["hook"],
      }),
    );
    expect(result.recalled.facts[0].created_at).toBeTruthy();
    expect(result.forgotten.forgotten).toBe(true);
    expect(ctx.rows).toHaveLength(0);
    const log = lines.join("\n");
    expect(log).not.toContain("The usual hook is a close-up face.");
    expect(log).not.toContain(fixtureKey);
    expect(log).not.toContain(fixtureSecret);
  });

  it("recalls at most 20 facts, newest first", async () => {
    const ctx = memoryContext();
    for (let i = 0; i < 21; i++)
      ctx.rows.push({
        id: `ddddddd${i}-ddd1-4dd1-8dd1-ddddddddddd${i}`,
        user_id: user.id,
        fact: `Packaging note ${i}`,
        tags: [],
        created_at: `2026-11-10T11:${String(i).padStart(2, "0")}:00.000Z`,
      });
    const recalled = await recallFacts(ctx, {});
    expect(recalled.facts).toHaveLength(20);
    expect(recalled.facts.every((row: { fact: string; id: string; tags: string[]; created_at: string }) =>
      row.id && row.fact && Array.isArray(row.tags) && row.created_at,
    )).toBe(true);
    expect(recalled.facts[0].fact).toBe("Packaging note 20");
    expect(recalled.facts[19].fact).toBe("Packaging note 1");
  });
});
