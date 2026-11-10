import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AppError } from "../src/lib/validation";
import { forgetFact, rememberFact } from "../src/lib/agent-memory";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
async function asUser(id: string) {
  await db.exec(
    `reset role;set request.jwt.claim.sub='${id}';set role authenticated;`,
  );
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
 create function public.app_web_access() returns boolean language sql stable as $$ select coalesce(current_setting('request.jwt.claim.owner',true),'true') <> 'false' $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage,public to authenticated,anon;grant all on storage.objects to authenticated;
 `);
  for (const file of readdirSync("supabase/migrations")
    .filter((s) => s.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL migration and row isolation", () => {
  it("creates private bucket and enables RLS on all app tables", async () => {
    const result = await db.query<{ public: boolean }>(
      "select public from storage.buckets",
    );
    expect(result.rows[0].public).toBe(false);
    const tables = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('studio_creations','studio_personas','studio_styles')",
    );
    expect(tables.rows).toHaveLength(3);
    expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("isolates creations and blocks owner reassignment", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_creations(user_id,title,prompt,mode,style) values('${alice}','My idea','A specific video concept','generate','Cinematic');`,
    );
    expect(
      (await db.query("select * from studio_creations")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(`update studio_creations set user_id='${bob}'`),
    ).rejects.toThrow();
    await asUser(bob);
    expect(
      (await db.query("select * from studio_creations")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into studio_creations(user_id,title,prompt,mode,style) values('${alice}','bad','A specific video concept','generate','Cinematic')`,
      ),
    ).rejects.toThrow();
  });
  it("rejects cross-account persona references", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_personas(id,user_id,name,refs) values('${alice}','${alice}','Alice',array['${alice}/references/a.png'])`,
    );
    await asUser(bob);
    await expect(
      db.exec(
        `insert into studio_creations(user_id,title,prompt,mode,style,persona_id) values('${bob}','bad','A specific video concept','generate','Cinematic','${alice}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into studio_personas(user_id,name,refs) values('${bob}','bad',array['${alice}/references/a.png'])`,
      ),
    ).rejects.toThrow();
  });
  it("enforces user folder isolation on storage reads, inserts and updates", async () => {
    await asUser(alice);
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('studio-assets','${alice}/references/a.png')`,
    );
    await expect(
      db.exec(`update storage.objects set name='${bob}/references/stolen.png'`),
    ).rejects.toThrow();
    await asUser(bob);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('studio-assets','${alice}/references/b.png')`,
      ),
    ).rejects.toThrow();
  });
  it("prevents repeated generation request identifiers", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_creations(user_id,title,prompt,mode,style,request_id) values('${alice}','idempotent','A specific video concept','generate','Cinematic','${alice}')`,
    );
    await expect(
      db.exec(
        `insert into studio_creations(user_id,title,prompt,mode,style,request_id) values('${alice}','duplicate','A specific video concept','generate','Cinematic','${alice}')`,
      ),
    ).rejects.toThrow();
  });
  it("allows deletion of a persona without deleting its creations", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_creations(user_id,title,prompt,mode,style,persona_id) values('${alice}','with persona','A specific video concept','generate','Cinematic','${alice}');delete from studio_personas where id='${alice}';`,
    );
    const result = await db.query<{ persona_id: string | null }>(
      "select persona_id from studio_creations where title='with persona'",
    );
    expect(result.rows[0].persona_id).toBeNull();
  });
  it("allows separate user accounts without changing unrelated app owner access", async () => {
    await asUser(bob);
    await db.exec("set request.jwt.claim.owner='false'");
    await db.exec(
      `insert into studio_creations(user_id,title,prompt,mode,style) values('${bob}','Bob owns this','A specific video concept','generate','Auto')`,
    );
    const rows = await db.query<{ user_id: string }>(
      "select user_id from studio_creations",
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].user_id).toBe(bob);
    await db.exec(
      `insert into studio_provider_keys(user_id,provider,ciphertext,suffix) values('${bob}','jev','encrypted-placeholder','test')`,
    );
    await asUser(alice);
    expect(
      (await db.query("select * from studio_provider_keys")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into studio_provider_keys(user_id,provider,ciphertext,suffix) values('${bob}','openai','stolen-placeholder','test')`,
      ),
    ).rejects.toThrow();
    await db.exec("set request.jwt.claim.owner='true'");
  });
  it("locks ready images and lineage while preserving metadata and deliberate deletion", async () => {
    await asUser(alice);
    const parent = "33333333-3333-4333-8333-333333333333",
      child = "44444444-4444-4444-8444-444444444444";
    await db.exec(
      `insert into studio_creations(id,user_id,title,prompt,mode,style,image_path,status) values('${parent}','${alice}','Immutable original','A specific video concept','generate','Auto','${alice}/original.png','ready');insert into studio_creations(id,user_id,title,prompt,mode,style,image_path,status,parent_id,lineage) values('${child}','${alice}','Immutable variant','A specific video concept','fix','Auto','${alice}/variant.png','ready','${parent}','{"sourceId":"${parent}","sourceDigest":"kept"}');`,
    );
    await expect(
      db.exec(
        `update studio_creations set image_path='${alice}/replacement.png' where id='${parent}'`,
      ),
    ).rejects.toThrow("immutable");
    await expect(
      db.exec(`update studio_creations set parent_id=null where id='${child}'`),
    ).rejects.toThrow("immutable");
    await db.exec(
      `update studio_creations set favorite=true where id='${child}';delete from studio_creations where id='${parent}'`,
    );
    const row = await db.query<{
      parent_id: string | null;
      lineage: { sourceId: string };
    }>(`select parent_id,lineage from studio_creations where id='${child}'`);
    expect(row.rows[0].parent_id).toBeNull();
    expect(row.rows[0].lineage.sourceId).toBe(parent);
  });
  it("persists isolated jobs and prevents request identity changes or deletion", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_jobs(id,user_id,operation,payload_digest,state,max_provider_calls) values('${alice}','${alice}','analyze',repeat('a',64),'queued',2)`,
    );
    await expect(
      db.exec(
        `update studio_jobs set payload_digest=repeat('b',64) where id='${alice}'`,
      ),
    ).rejects.toThrow("immutable");
    await expect(db.exec("delete from studio_jobs")).rejects.toThrow();
    await asUser(bob);
    expect((await db.query("select * from studio_jobs")).rows).toHaveLength(0);
  });
  it("reconciles expired dispatches after a hard process termination without retrying", async () => {
    await asUser(alice);
    const job = "55555555-5555-4555-8555-555555555555";
    await db.exec(
      `insert into studio_jobs(id,user_id,operation,payload_digest,state,max_provider_calls,deadline_at) values('${job}','${alice}','generate',repeat('f',64),'running',1,now()-interval '1 second');insert into studio_creations(user_id,title,prompt,mode,style,status,batch_id) values('${alice}','Interrupted dispatch','A specific video concept','generate','Auto','generating','${job}');`,
    );
    expect(
      (await db.query<{ n: number }>("select studio_reconcile_jobs() as n"))
        .rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query<{ state: string }>(
          `select state from studio_jobs where id='${job}'`,
        )
      ).rows[0].state,
    ).toBe("reconciling");
    expect(
      (
        await db.query<{ status: string }>(
          `select status from studio_creations where batch_id='${job}'`,
        )
      ).rows[0].status,
    ).toBe("reconciling");
    expect(
      (await db.query<{ n: number }>("select studio_reconcile_jobs() as n"))
        .rows[0].n,
    ).toBe(0);
  });
  it("permits new-user jobs and private external connections without other-user visibility", async () => {
    await asUser(bob); await db.exec("set request.jwt.claim.owner='false'");
    const job = "66666666-6666-4666-8666-666666666666";
    await db.exec(`insert into studio_jobs(id,user_id,operation,payload_digest,state,max_provider_calls) values('${job}','${bob}','analyze',repeat('b',64),'queued',1)`);
    await db.exec(`insert into studio_external_connections(user_id,provider,ciphertext) values('${bob}','higgsfield','encrypted-fixture')`);
    await db.exec(`insert into studio_connection_sessions(id,user_id,provider,ciphertext,expires_at) values('${job}','${bob}','higgsfield','encrypted-state',now()+interval '10 minutes')`);
    await asUser(alice);
    expect((await db.query("select * from studio_external_connections")).rows).toHaveLength(0);
    expect((await db.query("select * from studio_connection_sessions")).rows).toHaveLength(0);
    await expect(db.exec(`update studio_jobs set user_id='${alice}' where id='${job}'`)).resolves.toBeDefined();
    await asUser(bob);
    expect((await db.query(`select user_id from studio_jobs where id='${job}'`)).rows[0]).toEqual({ user_id: bob });
    await expect(db.exec(`update studio_external_connections set user_id='${alice}'`)).rejects.toThrow();
    await db.exec("set request.jwt.claim.owner='true'");
  });
  it("denies unauthenticated database access", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from studio_creations")).rejects.toThrow();
    await db.exec("reset role;");
  });

  it("accepts anthropic provider keys and still rejects an unknown provider", async () => {
    await asUser(alice);
    await db.exec(
      `insert into studio_provider_keys(user_id,provider,ciphertext,suffix) values('${alice}','anthropic','encrypted-placeholder','FAKE')`,
    );
    expect(
      (await db.query("select provider from studio_provider_keys where provider='anthropic'")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into studio_provider_keys(user_id,provider,ciphertext,suffix) values('${alice}','unknown','encrypted-placeholder','test')`,
      ),
    ).rejects.toThrow();
  });
  it("accepts a studio:agent grant and still rejects an unknown scope", async () => {
    await asUser(alice);
    const client = "a".repeat(64),
      grant = "77777777-7777-4777-8777-777777777777";
    await db.exec(
      `insert into studio_oauth_grants(id,user_id,client_id,client_name,redirect_uri,scope,expires_at) values('${grant}','${alice}','${client}','Local companion','https://127.0.0.1/callback',array['studio:read','studio:agent'],now()+interval '30 days')`,
    );
    expect(
      (await db.query("select id from studio_oauth_grants where id='"+grant+"'")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into studio_oauth_grants(id,user_id,client_id,client_name,redirect_uri,scope,expires_at) values('88888888-8888-4888-8888-888888888888','${alice}','${client}','Local companion','https://127.0.0.1/callback',array['studio:admin'],now()+interval '30 days')`,
      ),
    ).rejects.toThrow();
  });
});

describe('creative conversations and feedback ownership',()=>{
 it('keeps conversations, preferences and feedback private by owner',async()=>{
  await asUser(alice);
  await db.exec("insert into studio_conversations(id,user_id,title) values('33333333-3333-4333-8333-333333333333','"+alice+"','A creative session')");
  await db.exec("insert into studio_preferences(user_id,skip_persona_tutorial) values('"+alice+"',true)");
  await db.exec("insert into studio_feedback(user_id,body) values('"+alice+"','A useful image-linked note')");
  await asUser(bob);
  expect((await db.query("select * from studio_conversations")).rows).toHaveLength(0);
  expect((await db.query("select * from studio_preferences")).rows).toHaveLength(0);
  expect((await db.query("select * from studio_feedback")).rows).toHaveLength(0);
  await expect(db.exec("insert into studio_creations(user_id,title,prompt,mode,style,conversation_id) values('"+bob+"','My image','A truthful image concept','generate','Auto','33333333-3333-4333-8333-333333333333')")).rejects.toThrow();
 });
 it('does not reassign conversations or leak image feedback across accounts',async()=>{
  await asUser(alice);
  await expect(db.exec("update studio_conversations set user_id='"+bob+"'")).rejects.toThrow();
  await expect(db.exec("update studio_preferences set user_id='"+bob+"'")).rejects.toThrow();
  await asUser(bob);
  await expect(db.exec("insert into studio_feedback(user_id,creation_id,body) values('"+bob+"','"+alice+"','Cross-owner image feedback')")).rejects.toThrow();
 });
});

describe("agent memory isolation", () => {
  it("creates the memory table, enforces constraints, and caps rows per user", async () => {
    await asUser(alice);
    await db.exec(`delete from studio_agent_memory where user_id='${alice}'`);
    const id = "aaaaaaa1-aaa1-4aa1-8aa1-aaaaaaaaaaa1";
    await db.exec(
      `insert into studio_agent_memory(id,user_id,agent,fact,tags,source) values('${id}','${alice}','default','The usual hook is a close-up face.',array['hook'],'companion')`,
    );
    const rows = await db.query<{ fact: string }>(
      "select fact from studio_agent_memory where id='"+id+"'",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].fact).toBe("The usual hook is a close-up face.");
    await expect(
      db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','${"x".repeat(1001)}')`,
      ),
    ).rejects.toThrow();
    for (let i = 0; i < 499; i++)
      await db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','Fact ${i}')`,
      );
    await expect(
      db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','One past the cap')`,
      ),
    ).rejects.toThrow();
  });
  it("blocks another user from reading or deleting memory rows", async () => {
    await asUser(alice);
    await db.exec(`delete from studio_agent_memory where user_id='${alice}'`);
    const id = "bbbbbbb1-bbb1-4bb1-8bb1-bbbbbbbbbbb1";
    await db.exec(
      `insert into studio_agent_memory(id,user_id,agent,fact) values('${id}','${alice}','default','A private packaging preference.')`,
    );
    await asUser(bob);
    expect(
      (await db.query("select * from studio_agent_memory")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(`delete from studio_agent_memory where id='${id}'`),
    ).resolves.toBeDefined();
    await expect(
      db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','Stolen fact')`,
      ),
    ).rejects.toThrow();
    await asUser(alice);
    expect(
      (await db.query("select id from studio_agent_memory where id='"+id+"'")).rows,
    ).toHaveLength(1);
  });
  it("denies unauthenticated access to agent memory", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from studio_agent_memory")).rejects.toThrow();
    await expect(
      db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','Unauthenticated fact')`,
      ),
    ).rejects.toThrow();
    await db.exec("reset role;");
  });
  function memoryClient() {
    return {
      from(table: string) {
        let action = "select",
          value: any,
          filters: Record<string, string> = {},
          returning = "";
        const quote = (v: string) => "'" + String(v).replaceAll("'", "''") + "'";
        const where = () =>
          Object.entries(filters)
            .map(([k, v]) => k + "=" + quote(v))
            .join(" and ");
        const exec = async () => {
          try {
            if (action === "insert") {
              const tags = Array.isArray(value.tags)
                ? "array[" +
                  value.tags.map((t: string) => quote(t)).join(",") +
                  "]::text[]"
                : "'{}'";
              const source = value.source == null ? "null" : quote(value.source);
              const rows = await db.query(
                "insert into " +
                  table +
                  "(user_id,agent,fact,tags,source) values(" +
                  quote(value.user_id) +
                  "," +
                  quote(value.agent) +
                  "," +
                  quote(value.fact) +
                  "," +
                  tags +
                  "," +
                  source +
                  ") returning " +
                  (returning || "id,fact,tags,created_at"),
              );
              return { data: rows.rows, error: null };
            }
            if (action === "delete") {
              const rows = await db.query(
                "delete from " +
                  table +
                  " where " +
                  where() +
                  " returning " +
                  (returning || "id"),
              );
              return { data: rows.rows, error: null };
            }
            return { data: [], error: null };
          } catch (error) {
            return { data: null, error };
          }
        };
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
          select: (cols?: string) => {
            returning = cols || "id";
            return chain;
          },
          eq: (k: string, v: string) => {
            filters[k] = v;
            return chain;
          },
          single: async () => {
            const result = await exec();
            return {
              data: Array.isArray(result.data) ? result.data[0] || null : result.data,
              error: result.error,
            };
          },
          then: (resolve: any) => exec().then(resolve),
        };
        return chain;
      },
    };
  }
  function memoryAuth(userId: string) {
    return {
      db: memoryClient(),
      user: { id: userId },
      oauth: { scope: ["studio:agent"] as const },
    };
  }
  it("returns forgotten false for an unknown or other user's fact under RLS, and true for your own", async () => {
    await asUser(alice);
    await db.exec(`delete from studio_agent_memory where user_id='${alice}'`);
    const saved = await rememberFact(memoryAuth(alice), {
      fact: "A private packaging preference.",
      agent: "default",
    });
    expect(
      (await forgetFact(memoryAuth(alice), { id: "99999999-9999-4999-8999-999999999999" }))
        .forgotten,
    ).toBe(false);
    await asUser(bob);
    expect((await forgetFact(memoryAuth(bob), { id: saved.id })).forgotten).toBe(false);
    await asUser(alice);
    expect(
      (await db.query("select id from studio_agent_memory where id='"+saved.id+"'")).rows,
    ).toHaveLength(1);
    expect((await forgetFact(memoryAuth(alice), { id: saved.id })).forgotten).toBe(true);
    expect(
      (await db.query("select id from studio_agent_memory where id='"+saved.id+"'")).rows,
    ).toHaveLength(0);
  });
  it("returns 4xx 'memory is full, forget something first' when the cap is hit", async () => {
    await asUser(alice);
    await db.exec(`delete from studio_agent_memory where user_id='${alice}'`);
    for (let i = 0; i < 500; i++)
      await db.exec(
        `insert into studio_agent_memory(user_id,agent,fact) values('${alice}','default','Fact ${i}')`,
      );
    try {
      await rememberFact(memoryAuth(alice), {
        fact: "One past the cap",
        agent: "default",
      });
      throw new Error("should have failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBeGreaterThanOrEqual(400);
      expect((error as AppError).status).toBeLessThan(500);
      expect((error as AppError).message).toBe("memory is full, forget something first");
    }
  });
});

describe("signed upload claim and grants", () => {
  const uploadId = "dddddddd-ddd1-4dd1-8dd1-ddddddddddd1",
    requestA = "dddddddd-ddd1-4dd1-8dd1-ddddddddddd2",
    requestB = "dddddddd-ddd1-4dd1-8dd1-ddddddddddd3",
    uploadPath = `${alice}/references/${uploadId}.png`;
  async function insertOpenUpload() {
    await db.exec(
      `insert into studio_upload_urls(id,user_id,path,issued_at,expires_at) values('${uploadId}','${alice}','${uploadPath}',now(),now()+interval '5 minutes')`,
    );
  }
  it("does not let an authenticated user update or reset used_at", async () => {
    await db.exec("reset role;");
    await db.exec(`delete from studio_upload_urls where user_id='${alice}'`);
    await asUser(alice);
    await insertOpenUpload();
    const claimed = await db.query<{ used_request_id: string }>(
      `select * from studio_claim_upload_url('${uploadId}'::uuid,'${requestA}'::uuid)`,
    );
    expect(claimed.rows).toHaveLength(1);
    expect(claimed.rows[0].used_request_id).toBe(requestA);
    await expect(
      db.exec(`update studio_upload_urls set used_at=null where id='${uploadId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update studio_upload_urls set used_at=now() where id='${uploadId}'`),
    ).rejects.toThrow();
    const row = await db.query<{ used_at: string | null; used_request_id: string }>(
      `select used_at,used_request_id from studio_upload_urls where id='${uploadId}'`,
    );
    expect(row.rows[0].used_at).not.toBeNull();
    expect(row.rows[0].used_request_id).toBe(requestA);
  });
  it("lets only one of two concurrent claims with different request ids win", async () => {
    await db.exec("reset role;");
    await db.exec(`delete from studio_upload_urls where user_id='${alice}'`);
    await asUser(alice);
    await insertOpenUpload();
    const [first, second] = await Promise.all([
      db.query<{ used_request_id: string }>(
        `select * from studio_claim_upload_url('${uploadId}'::uuid,'${requestA}'::uuid)`,
      ),
      db.query<{ used_request_id: string }>(
        `select * from studio_claim_upload_url('${uploadId}'::uuid,'${requestB}'::uuid)`,
      ),
    ]);
    expect([first.rows.length, second.rows.length].sort()).toEqual([0, 1]);
    const winner = first.rows[0] || second.rows[0];
    expect(winner.used_request_id).toBeTruthy();
    const stored = await db.query<{ used_request_id: string }>(
      `select used_request_id from studio_upload_urls where id='${uploadId}'`,
    );
    expect(stored.rows[0].used_request_id).toBe(winner.used_request_id);
    expect([requestA, requestB]).toContain(stored.rows[0].used_request_id);
  });

  it("a losing claim returns no row, not a row of nulls", async () => {
    await db.exec("reset role;");
    await db.exec(`delete from studio_upload_urls where user_id='${alice}'`);
    await asUser(alice);
    await insertOpenUpload();
    await db.query(
      `select * from studio_claim_upload_url('${uploadId}'::uuid,'${requestA}'::uuid)`,
    );
    const loser = await db.query(
      `select * from studio_claim_upload_url('${uploadId}'::uuid,'${requestB}'::uuid)`,
    );
    expect(loser.rows).toHaveLength(0);
    const pgrst = await db.query<{ body: string }>(
      `select coalesce(json_agg(_postgrest_t),'[]')::text as body from studio_claim_upload_url('${uploadId}'::uuid,'${requestB}'::uuid) _postgrest_t`,
    );
    expect(JSON.parse(pgrst.rows[0].body)).toEqual([]);
  });
});

describe("profile unique names migration", () => {
  it("trims names, suffixes later duplicates, skips taken suffixes, then the unique index holds", async () => {
    const local = new PGlite();
    await local.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
 create function public.app_web_access() returns boolean language sql stable as $$ select coalesce(current_setting('request.jwt.claim.owner',true),'true') <> 'false' $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage,public to authenticated,anon;grant all on storage.objects to authenticated;
 `);
    const files = readdirSync("supabase/migrations")
      .filter((s) => s.endsWith(".sql"))
      .sort();
    const uniqueNames = files.filter((s) => s.endsWith("_profile_unique_names.sql"));
    expect(uniqueNames).toEqual(["20261110130000_profile_unique_names.sql"]);
    for (const file of files.filter((s) => s !== uniqueNames[0]))
      await local.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    const aliceRef = `${alice}/references/a.png`,
      bobRef = `${bob}/references/a.png`;
    await local.exec(`
      insert into studio_personas(id,user_id,name,refs,created_at) values
        ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001','${alice}','  Derrick  ',array['${aliceRef}'],'2026-11-01T00:00:00Z'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002','${alice}','Derrick (2)',array['${aliceRef}'],'2026-11-02T00:00:00Z'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003','${alice}','derrick',array['${aliceRef}'],'2026-11-03T00:00:00Z'),
        ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004','${bob}','Derrick',array['${bobRef}'],'2026-11-01T00:00:00Z');
      insert into studio_styles(id,user_id,name,refs,created_at) values
        ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001','${alice}','  Derrick  ',array['${aliceRef}'],'2026-11-01T00:00:00Z'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002','${alice}','DERRICK',array['${aliceRef}'],'2026-11-04T00:00:00Z');
    `);
    await local.exec(readFileSync("supabase/migrations/" + uniqueNames[0], "utf8"));
    const personas = await local.query<{ id: string; name: string }>(
      "select id,name from studio_personas order by id",
    );
    expect(personas.rows).toEqual([
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", name: "Derrick" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002", name: "Derrick (2)" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003", name: "derrick (3)" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004", name: "Derrick" },
    ]);
    const styles = await local.query<{ id: string; name: string }>(
      "select id,name from studio_styles order by id",
    );
    expect(styles.rows).toEqual([
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", name: "Derrick" },
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002", name: "DERRICK (2)" },
    ]);
    const leftover = await local.query(
      `select user_id,kind,key,count(*) from (
         select user_id,'persona'::text as kind,lower(btrim(name)) as key from studio_personas
         union all
         select user_id,'style',lower(btrim(name)) from studio_styles
       ) s group by 1,2,3 having count(*)>1`,
    );
    expect(leftover.rows).toHaveLength(0);
    await local.exec(`reset role;set request.jwt.claim.sub='${alice}';set role authenticated;`);
    await expect(
      local.exec(
        `insert into studio_personas(user_id,name,refs) values('${alice}',' derrick ',array['${aliceRef}'])`,
      ),
    ).rejects.toThrow();
    await local.exec(
      `insert into studio_personas(user_id,name,refs) values('${alice}','Beatrice',array['${aliceRef}'])`,
    );
    const race = await Promise.allSettled([
      local.exec(`insert into studio_personas(user_id,name,refs) values('${alice}','Race Name',array['${aliceRef}'])`),
      local.exec(`insert into studio_personas(user_id,name,refs) values('${alice}',' race name ',array['${aliceRef}'])`),
    ]);
    expect(race.map(result => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const raceRows = await local.query("select name from studio_personas where lower(btrim(name))='race name'");
    expect(raceRows.rows).toHaveLength(1);
    await local.close();
  });
});
