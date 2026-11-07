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
  it("enforces the existing owner gate even for a valid row owner", async () => {
    await asUser(alice);
    await db.exec("set request.jwt.claim.owner='false'");
    expect(
      (await db.query("select * from studio_creations")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into studio_creations(user_id,title,prompt,mode,style) values('${alice}','blocked','A specific video concept','generate','Auto')`,
      ),
    ).rejects.toThrow();
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await db.exec("set request.jwt.claim.owner='true'");
  });
  it("denies unauthenticated database access", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from studio_creations")).rejects.toThrow();
    await db.exec("reset role;");
  });
});
