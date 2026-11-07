"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localAll, localPut, localDelete } from "./local-db";
import {
  defaultSettings,
  type Config,
  type Creation,
  type Persona,
  type Style,
  type Format,
  type Settings,
} from "./types";
type Asset = { id: string; blob: Blob };
type Collection = "creations" | "personas" | "styles";
export function useStudio() {
  const [config, setConfig] = useState<Config | null>(null),
    [user, setUser] = useState<string | null>(null),
    [creations, setCreations] = useState<Creation[]>([]),
    [personas, setPersonas] = useState<Persona[]>([]),
    [styles, setStyles] = useState<Style[]>([]),
    [images, setImages] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const db = useRef<SupabaseClient | null>(null),
    urls = useRef<string[]>([]),
    lock = useRef(false),
    version = useRef(0),
    userRef = useRef<string | null>(null),
    pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const cloud = !!user && !!db.current,
    live = cloud && !!config?.ai && (!!config?.openai || !!config?.google);
  const load = useCallback(async () => {
    const current = ++version.current;
    if (db.current && user) {
      const rows = await Promise.all(
        ["creations", "personas", "styles"].map((x) =>
          db
            .current!.from("studio_" + x)
            .select("*")
            .order("created_at", { ascending: false }),
        ),
      );
      if (current !== version.current) return;
      if (rows.some((r) => r.error))
        throw new Error(
          "Cloud library is not ready. Check the migration and owner access.",
        );
      setCreations(rows[0].data as Creation[]);
      setPersonas(rows[1].data as Persona[]);
      setStyles(rows[2].data as Style[]);
      const paths = [
        ...new Set(
          [
            ...rows[0].data!.flatMap((x) => [
              x.image_path,
              ...(x.reference_paths || []),
            ]),
            ...rows[1].data!.flatMap((x) => x.refs),
            ...rows[2].data!.flatMap((x) => x.refs),
          ].filter(Boolean),
        ),
      ];
      if (paths.length) {
        const signed = await db.current.storage
          .from("studio-assets")
          .createSignedUrls(paths, 300);
        if (current !== version.current) return;
        if (signed.error) throw new Error("Private previews could not load.");
        setImages(
          Object.fromEntries(
            (signed.data || [])
              .filter((x) => x.signedUrl)
              .map((x) => [x.path!, x.signedUrl!]),
          ),
        );
      } else setImages({});
    } else {
      const [c, p, s, a] = await Promise.all([
        localAll<Creation>("creations"),
        localAll<Persona>("personas"),
        localAll<Style>("styles"),
        localAll<Asset>("assets"),
      ]);
      if (current !== version.current) return;
      setCreations(c.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setPersonas(p);
      setStyles(s);
      urls.current.forEach(URL.revokeObjectURL);
      const entries = a.map((x) => {
        const url = URL.createObjectURL(x.blob);
        urls.current.push(url);
        return [x.id, url];
      });
      setImages(Object.fromEntries(entries));
    }
  }, [user]);
  useEffect(() => {
    let stop = () => {};
    fetch("/api/config")
      .then((r) => r.json())
      .then(async (c: Config) => {
        setConfig(c);
        if (c.cloud) {
          db.current = createClient(c.supabaseUrl, c.supabaseKey);
          const { data } = await db.current.auth.getSession();
          userRef.current = data.session?.user.id || null;
          setUser(userRef.current);
          const result = db.current.auth.onAuthStateChange((_, session) => {
            const next = session?.user.id || null;
            if (next !== userRef.current) {
              userRef.current = next;
              version.current++;
              setCreations([]);
              setPersonas([]);
              setStyles([]);
              setImages({});
              setUser(next);
            }
          });
          stop = () => result.data.subscription.unsubscribe();
        }
      })
      .catch(() =>
        setError(
          "Connection settings did not load. Local drafts remain available.",
        ),
      );
    return () => {
      stop();
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    if (user)
      void headers()
        .then((h) => fetch("/api/config", { headers: h }))
        .then((r) => r.json())
        .then(setConfig)
        .catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!cloud) return;
    const timer = setInterval(() => load().catch(() => {}), 240000);
    return () => clearInterval(timer);
  }, [cloud, load]);
  async function run<T>(
    label: string,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    try {
      return await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The operation failed. Please try again.",
      );
      return undefined;
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function headers() {
    const { data } = db.current
      ? await db.current.auth.getSession()
      : { data: { session: null } };
    return {
      "Content-Type": "application/json",
      ...(data.session
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
    };
  }
  async function api(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "The request did not finish.");
    return result;
  }
  function requireLive() {
    if (!live)
      throw new Error(
        cloud
          ? "AI rendering is not connected yet. You can save a draft or resize an uploaded image."
          : "Sign in to the connected cloud workspace to use AI. Uploads, drafts and instant resize work locally.",
      );
  }
  async function put(kind: Collection, item: Creation | Persona | Style) {
    if (cloud) {
      const { error } = await db
        .current!.from("studio_" + kind)
        .upsert({ ...item, user_id: user });
      if (error)
        throw new Error("Could not save to the private cloud library.");
    } else await localPut(kind, item);
  }
  async function upload(file: File) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw new Error("Choose a PNG, JPG or WebP under 5 MB.");
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40000000) {
      bitmap.close();
      throw new Error("Use an image smaller than 40 megapixels.");
    }
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image decoding failed."))),
        "image/png",
      ),
    );
    const id = cloud
      ? `${user}/references/${crypto.randomUUID()}.png`
      : crypto.randomUUID();
    if (cloud) {
      const { error } = await db
        .current!.storage.from("studio-assets")
        .upload(id, blob, { contentType: "image/png" });
      if (error)
        throw new Error("Upload failed. Check private storage access.");
    } else await localPut("assets", { id, blob });
    return id;
  }
  async function importReference(url: string) {
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const value = await res.json();
      throw new Error(value.error || "Image import failed.");
    }
    return upload(
      new File([await res.blob()], "reference.png", { type: "image/png" }),
    );
  }
  async function blob(path: string) {
    if (cloud) {
      const { data, error } = await db
        .current!.storage.from("studio-assets")
        .download(path);
      if (error || !data) throw new Error("Image not found.");
      return data;
    }
    const assets = await localAll<Asset>("assets");
    const asset = assets.find((x) => x.id === path);
    if (!asset) throw new Error("Image is missing from this browser.");
    return asset.blob;
  }
  async function saveDraft(input: {
    prompt: string;
    title: string;
    mode: Creation["mode"];
    style: string;
    personaId: string;
    styleId: string;
    referencePaths: string[];
    settings: Settings;
    parentId: string | null;
  }) {
    if (input.prompt.trim().length < 8)
      throw new Error("Add at least eight characters to describe your idea.");
    const item: Creation = {
      id: crypto.randomUUID(),
      title: input.title || input.prompt.slice(0, 80),
      prompt: input.prompt,
      mode: input.mode,
      style: input.style,
      persona_id: input.personaId || null,
      style_id: input.styleId || null,
      reference_path: input.referencePaths[0] || null,
      reference_paths: input.referencePaths,
      settings: input.settings,
      parent_id: input.parentId,
      image_path: null,
      status: "draft",
      favorite: false,
      created_at: new Date().toISOString(),
    };
    await put("creations", item);
    await load();
    return item;
  }
  async function saveUploaded(path: string, title = "Uploaded thumbnail") {
    const item: Creation = {
      id: crypto.randomUUID(),
      title,
      prompt: title.padEnd(8, "."),
      mode: "generate",
      style: "Uploaded",
      persona_id: null,
      parent_id: null,
      image_path: path,
      status: "ready",
      favorite: false,
      created_at: new Date().toISOString(),
    };
    await put("creations", item);
    await load();
    return item;
  }
  async function generate(input: unknown) {
    requireLive();
    const value = input as Record<string, unknown>;
    const { requestId: ignored, ...intent } = value;
    const fingerprint = JSON.stringify(intent);
    if (pendingRequest.current?.fingerprint !== fingerprint)
      pendingRequest.current = {
        fingerprint,
        id: String(value.requestId || crypto.randomUUID()),
      };
    const result = await api("/api/generate", {
      ...value,
      requestId: pendingRequest.current!.id,
    });
    pendingRequest.current = null;
    await load();
    return result as { creations: Creation[]; partial: boolean };
  }
  async function analyze(
    item: Creation,
    title: string,
    videoBrief = "",
    includeVision = false,
  ) {
    if (!cloud || !config?.ai)
      throw new Error(
        "Sign in and connect your own Jev key to score thumbnails.",
      );
    if (!config?.jev) throw new Error("Jev is not connected yet.");
    const intent = { creationId: item.id, title, videoBrief, includeVision };
    const fingerprint = JSON.stringify(intent);
    if (pendingRequest.current?.fingerprint !== fingerprint)
      pendingRequest.current = { fingerprint, id: crypto.randomUUID() };
    const result = await api("/api/analyze", {
      ...intent,
      requestId: pendingRequest.current.id,
    });
    pendingRequest.current = null;
    await load();
    return result;
  }
  async function saveProfile(
    kind: "persona" | "style",
    name: string,
    notes: string,
    files: File[],
  ) {
    if (!name.trim() || files.length < 1 || files.length > 6)
      throw new Error("Add a name and one to six reference photos.");
    const refs: string[] = [];
    try {
      for (const file of files) refs.push(await upload(file));
      const item = {
        id: crypto.randomUUID(),
        name: name.trim(),
        notes,
        refs,
        created_at: new Date().toISOString(),
        profile_status: "draft" as const,
      };
      await put(kind === "persona" ? "personas" : "styles", item);
      await load();
      return item;
    } catch (e) {
      if (cloud && refs.length)
        await db.current!.storage.from("studio-assets").remove(refs);
      else for (const id of refs) await localDelete("assets", id);
      throw e;
    }
  }
  async function prepare(kind: "persona" | "style", id: string) {
    requireLive();
    const result = await api("/api/persona/prepare", { id, kind });
    await load();
    return result.profile;
  }
  async function resize(item: Creation, format: Format) {
    if (!item.image_path)
      throw new Error("Choose an uploaded or generated image to resize.");
    if (cloud) {
      const result = await api("/api/resize", {
        creationId: item.id,
        format,
        requestId: crypto.randomUUID(),
      });
      await load();
      return result.creation as Creation;
    }
    const bitmap = await createImageBitmap(await blob(item.image_path));
    const width = format === "short" ? 720 : 1280,
      height = format === "short" ? 1280 : 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const cover = Math.max(width / bitmap.width, height / bitmap.height);
    ctx.filter = "blur(28px) brightness(50%)";
    ctx.drawImage(
      bitmap,
      (width - bitmap.width * cover) / 2,
      (height - bitmap.height * cover) / 2,
      bitmap.width * cover,
      bitmap.height * cover,
    );
    ctx.filter = "none";
    const fit = Math.min(width / bitmap.width, height / bitmap.height);
    ctx.drawImage(
      bitmap,
      (width - bitmap.width * fit) / 2,
      (height - bitmap.height * fit) / 2,
      bitmap.width * fit,
      bitmap.height * fit,
    );
    bitmap.close();
    const resized = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Resize failed."))),
        "image/png",
      ),
    );
    const path = crypto.randomUUID();
    await localPut("assets", { id: path, blob: resized });
    const copy: Creation = {
      ...item,
      id: crypto.randomUUID(),
      mode: "resize",
      parent_id: item.id,
      image_path: path,
      settings: { ...(item.settings || defaultSettings), format },
      score: null,
      created_at: new Date().toISOString(),
    };
    await put("creations", copy);
    await load();
    return copy;
  }
  async function remove(kind: Collection, id: string) {
    if (cloud) {
      const { error } = await db
        .current!.from("studio_" + kind)
        .delete()
        .eq("id", id);
      if (error) throw new Error("Delete failed.");
    } else await localDelete(kind, id);
    await load();
  }
  async function favorite(item: Creation) {
    await put("creations", { ...item, favorite: !item.favorite });
    await load();
  }
  async function download(item: Creation) {
    if (!item.image_path)
      throw new Error("Render this draft before downloading it.");
    const url = URL.createObjectURL(await blob(item.image_path));
    const link = document.createElement("a");
    link.href = url;
    link.download = `openpikzel-${item.id}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function login(email: string, password: string) {
    if (!db.current) throw new Error("Cloud sign-in is not configured yet.");
    const { error } = await db.current.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      throw new Error("Sign-in failed. Check your email and password.");
  }
  async function logout() {
    await db.current?.auth.signOut({ scope: "local" });
  }
  return {
    config,
    user,
    cloud,
    live,
    loading,
    creations,
    personas,
    styles,
    images,
    busy,
    error,
    setError,
    run,
    load,
    upload,
    importReference,
    saveDraft,
    saveUploaded,
    generate,
    analyze,
    saveProfile,
    prepare,
    resize,
    remove,
    favorite,
    download,
    login,
    logout,
    api,
    authHeaders: headers,
    requireLive,
  };
}
