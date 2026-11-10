import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
