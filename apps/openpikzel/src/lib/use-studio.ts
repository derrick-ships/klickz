"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {type Conversation} from "./workspaces";
import { localAll, localPut, localDelete, localProfileTransaction, localCreateProfile, localRenameProfile } from "./local-db";
import {
  defaultSettings,
  type Config,
  type Creation,
  type Persona,
  type Style,
  type Format,
  type Settings,
  type TextProvider,
} from "./types";
import type { VisionProvider } from "./vision-provider";
import { missingVisionKeyMessage } from "./score-on-generate";
import { forgetPendingRequest, rememberPendingRequest } from "./pending-requests";
type Asset = { id: string; blob: Blob };
type Collection = "creations" | "personas" | "styles" | "conversations";
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
  const [configStatus,setConfigStatus]=useState<"loading"|"ready"|"failed">("loading");
  const [conversations,setConversations]=useState<Conversation[]>([]),[skipPersonaTutorial,setSkipPersonaTutorial]=useState(false);
  const loadedOwner=useRef<string|null|undefined>(undefined);
  const ownerEpoch=useRef(0),chatWrites=useRef(Promise.resolve());
  const db = useRef<SupabaseClient | null>(null),
    urls = useRef<string[]>([]),
    lock = useRef(false),
    version = useRef(0),
    userRef = useRef<string | null>(null),
    pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const pendingAnalysis = useRef(new Map<string, string>());
  const pendingFix = useRef(new Map<string, Promise<unknown>>());
  const pendingFixJobs = useRef(new Map<string, {requestId:string;fixPlanToken:string;plan:{title:string;sourceId:string;settings:Settings};notice?:string}>());
  const unknownOutcomes = new WeakSet<object>();
  const cloud = !!user && !!db.current,
    live = cloud && !!config?.ai && (!!config?.openai || !!config?.google);
  const load = useCallback(async () => {
    if(userRef.current!==user)return;
    const current = ++version.current;
    if (db.current && user) {
      const rows = await Promise.all(
        ["creations", "personas", "styles", "conversations"].map((x) =>
          db
            .current!.from("studio_" + x)
            .select("*")
            .order("created_at", { ascending: false }),
        ),
      );
      if (current !== version.current || userRef.current!==user) return;
      if (rows.some((r) => r.error))
        throw new Error(
          "Your cloud library could not load. Refresh the page; if it still fails, contact the workspace owner.",
        );
      setCreations(rows[0].data as Creation[]);
      setPersonas(rows[1].data as Persona[]);
      setStyles(rows[2].data as Style[]);
      setConversations(rows[3].data as Conversation[]);
      const pref=await db.current.from("studio_preferences").select("skip_persona_tutorial").eq("user_id",user).maybeSingle();if(current!==version.current||userRef.current!==user)return;setSkipPersonaTutorial(pref.data?.skip_persona_tutorial===true);
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
        if (current !== version.current || userRef.current!==user) return;
        if (signed.error) throw new Error("Your private images could not load. Refresh the page to try again.");
        setImages(
          Object.fromEntries(
            (signed.data || [])
              .filter((x) => x.signedUrl)
              .map((x) => [x.path!, x.signedUrl!]),
          ),
        );
      } else setImages({});
    } else {
      const [c, a, chats, preferences] = await Promise.all([
        localAll<Creation>("creations"),
        localAll<Asset>("assets"),
        localAll<Conversation>("conversations"),
        localAll<{id:string;skip_persona_tutorial?:boolean}>("preferences"),
      ]);
      if (current !== version.current || userRef.current!==user) return;
      const [personasNext,stylesNext]=await Promise.all([localProfileTransaction<Persona>("persona",{repair:true}) as Promise<Persona[]>,localProfileTransaction<Style>("style",{repair:true}) as Promise<Style[]>]);
      if (current !== version.current || userRef.current!==user) return;
      setCreations(c.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setPersonas(personasNext);
      setStyles(stylesNext);
      setConversations(chats);setSkipPersonaTutorial(preferences.find(p=>p.id==="local")?.skip_persona_tutorial===true);
      urls.current.forEach(URL.revokeObjectURL);
      const entries = a.map((x) => {
        const url = URL.createObjectURL(x.blob);
        urls.current.push(url);
        return [x.id, url];
      });
      setImages(Object.fromEntries(entries));
    }
    if(userRef.current===user)loadedOwner.current=user;
  }, [user]);
  useEffect(() => {
    let stop = () => {};
    fetch("/api/config")
      .then((r) => {if(!r.ok)throw new Error("Connection settings did not load.");return r.json();})
      .then(async (c: Config) => {
        setConfig(c);
        if (c.cloud) {
          const {createClient}=await import("@supabase/supabase-js");
          db.current = createClient(c.supabaseUrl, c.supabaseKey);
          const { data } = await db.current.auth.getSession();
          userRef.current = data.session?.user.id || null;
          setUser(userRef.current);
          const result = db.current.auth.onAuthStateChange((_, session) => {
            const next = session?.user.id || null;
            if (next !== userRef.current) {
              userRef.current = next;
              setConfig(current=>current?{...current,openai:false,google:false,jev:false,youtube:false,connectionStatus:next?"loading":"ready"}:current);
              ownerEpoch.current++;setError("");setConversations([]);setSkipPersonaTutorial(false);pendingRequest.current=null;pendingAnalysis.current.clear();pendingFix.current.clear();pendingFixJobs.current.clear();
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
        setConfigStatus("ready");
      })
      .catch(() => {
        setConfigStatus("failed");setError(
          "Connection settings did not load. Local drafts remain available.",
        );},
      );
    return () => {
      stop();
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((e) => { if (active && userRef.current === user) { loadedOwner.current = user; setError(e.message); } })
      .finally(() => { if (active && userRef.current === user) setLoading(false); });
    return () => { active = false; };
  }, [load, user]);
  useEffect(() => {
    let active = true;
    const epoch = ownerEpoch.current;
    if (user){
      setConfig(current=>current?{...current,openai:false,google:false,jev:false,youtube:false,connectionStatus:"loading"}:current);
      void headers()
        .then((h) => fetch("/api/config", { headers: h }))
        .then((r) => {if(!r.ok)throw new Error("Connection settings did not load.");return r.json();})
        .then(value => { if (active && epoch === ownerEpoch.current) setConfig({...value,connectionStatus:"ready"}); })
        .catch(() => {if(active&&epoch===ownerEpoch.current){setConfig(current=>current?{...current,openai:false,google:false,jev:false,youtube:false,connectionStatus:"failed"}:current);setError("Your provider connection status could not load. Open Connections to refresh it before using AI. Your drafts remain safe.");}});
    }
    return () => { active = false; };
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
    if (lock.current) { setError("Another workspace action is still running. Wait for it to finish, then try this action again."); return; }
    lock.current = true;
    const startedEpoch = ownerEpoch.current;
    setBusy(label);
    setError("");
    try {
      return await work();
    } catch (e) {
      if (startedEpoch !== ownerEpoch.current) return undefined;
      setError(
        e instanceof Error
          ? e.message
          : "This action did not finish. Check My creations before trying again.",
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
    const epoch=ownerEpoch.current;ensureCurrentOwner();
    const requestHeaders=await headers();
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    let res: Response;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(body),
      });
    } catch (e) {
      const error = e instanceof Error ? e : new Error("The request did not finish. Check My creations before retrying.");
      unknownOutcomes.add(error);
      throw error;
    }
    let result: any;
    try {
      result = await res.json();
    } catch (e) {
      const error = e instanceof Error ? e : new Error("The request did not finish. Check My creations before retrying.");
      unknownOutcomes.add(error);
      throw error;
    }
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    if (!res.ok) {
      const error = new Error(result.error || "The request did not finish. Check My creations before retrying.");
      if (res.status === 502 || res.status === 503 || res.status === 504) unknownOutcomes.add(error);
      throw error;
    }
    return result;
  }
  async function read(path: string, signal?: AbortSignal) {
    const epoch=ownerEpoch.current;ensureCurrentOwner();
    if(!cloud)throw new Error("Sign in to read your API activity.");
    const requestHeaders=await headers();
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    const response=await fetch(path,{headers:requestHeaders,signal,cache:"no-store"});
    const result=await response.json();
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    if(!response.ok)throw new Error(result.error||"Activity could not refresh. Your existing requests were not resubmitted.");
    return result;
  }
  function requireLive() {
    if(config?.connectionStatus==="failed")throw new Error("Provider connection status is unavailable. Open Connections to refresh it before using AI.");
    if (!live)
      throw new Error(
        cloud
          ? config?.ai
            ? "Connect OpenAI or Google in Connections to generate images and titles. You can still save drafts or resize an uploaded image."
            : "AI generation is not enabled in this workspace. You can still save drafts or resize an uploaded image."
          : "Sign in and connect your own API key to use AI. Uploads, drafts and resize also work in this browser.",
      );
  }
  function ensureCurrentOwner(){if(userRef.current!==user)throw new Error("Your account changed. Check the original account for the result.");}
  async function put(kind: Collection, item: Creation | Persona | Style | Conversation) {
    ensureCurrentOwner();
    if (cloud) {
      const { error } = await db
        .current!.from("studio_" + kind)
        .upsert({ ...item, user_id: user });
      if (error)
        throw new Error("Could not save to your cloud library. Keep this page open and check your connection before retrying.");
    } else await localPut(kind, item);
    ensureCurrentOwner();
  }
  async function upload(file: File) {
    const epoch=ownerEpoch.current;ensureCurrentOwner();
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
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    const id = cloud
      ? `${user}/references/${crypto.randomUUID()}.png`
      : crypto.randomUUID();
    if (cloud) {
      const { error } = await db
        .current!.storage.from("studio-assets")
        .upload(id, blob, { contentType: "image/png" });
      if (error)
        throw new Error("The image could not upload. Check your connection and try again.");
    } else await localPut("assets", { id, blob });
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    return id;
  }
  async function importReference(url: string) {
    const epoch=ownerEpoch.current;ensureCurrentOwner();
    const requestHeaders=await headers();
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    const res = await fetch("/api/reference", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ url }),
    });
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");ensureCurrentOwner();
    if (!res.ok) {
      const value = await res.json();
      throw new Error(value.error || "Could not import the image. Check that the link is public, or upload the file instead.");
    }
    const encodedTitle = res.headers.get("X-Video-Title");
    let videoTitle: string | null = null;
    try { videoTitle = encodedTitle ? decodeURIComponent(encodedTitle) : null; } catch { videoTitle = null; }
    const path = await upload(
      new File([await res.blob()], "reference.png", { type: "image/png" }),
    );
    return { path, videoTitle };
  }
  async function blob(path: string) {
    if (cloud) {
      const { data, error } = await db
        .current!.storage.from("studio-assets")
        .download(path);
      if (error || !data) throw new Error("This image is not available. Choose another image or upload it again.");
      return data;
    }
    const assets = await localAll<Asset>("assets");
    const asset = assets.find((x) => x.id === path);
    if (!asset) throw new Error("This image is not saved in this browser. Upload it again to continue.");
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
    conversationId?: string | null;
  }) {
    if (input.prompt.trim().length < 8)
      throw new Error("Add at least eight characters to describe your idea.");
    const item: Creation = {
      id: crypto.randomUUID(),
      conversation_id: input.conversationId || null,
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
    ensureCurrentOwner();
    return item;
  }
  async function saveUploaded(path: string, title = "Uploaded thumbnail",conversationId:string|null=null) {
    const item: Creation = {
      id: crypto.randomUUID(),
      title,
      conversation_id: conversationId,
      prompt: title.padEnd(8, "."),
      mode: "generate",
      style: "Uploaded",
      lineage:{origin:"uploaded"},
      persona_id: null,
      parent_id: null,
      image_path: path,
      status: "ready",
      favorite: false,
      created_at: new Date().toISOString(),
    };
    await put("creations", item);
    await load();
    ensureCurrentOwner();
    return item;
  }
  async function generate(input: unknown) {
    const epoch=ownerEpoch.current;
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
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed. Check the original account for the result.");
    if(result.creations?.[0])await rememberCreation(result.creations[0]);
    await load();
    ensureCurrentOwner();
    pendingRequest.current = null;
    return result as { creations: Creation[]; partial: boolean };
  }
  async function analyze(
    item: Creation,
    title: string,
    videoBrief = "",
    includeVision = false,
    videoUrl = "",
    critiqueProvider?: VisionProvider,
  ) {
    const epoch=ownerEpoch.current;
    if (!cloud)
      throw new Error(
        "Sign in and connect your own Jev key to score thumbnails.",
      );
    if (!config?.ai)
      throw new Error(
        "Scoring is not enabled in this workspace. Your saved images remain available to review and download.",
      );
    if (!config?.jev) throw new Error("Connect your Jev API key in Connections, then analyze this thumbnail again.");
    if(includeVision&&!(critiqueProvider&&config?.[critiqueProvider]))throw new Error(missingVisionKeyMessage(critiqueProvider));
    const intent = { creationId: item.id, title, videoBrief, includeVision, videoUrl, critiqueProvider };
    const fingerprint = JSON.stringify(intent);
    const requestId = rememberPendingRequest(pendingAnalysis.current, item.id, fingerprint);
    const result = await api("/api/analyze", {
      ...intent,
      requestId,
    });
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed. Check the original account for the result.");
    await load();
    ensureCurrentOwner();
    forgetPendingRequest(pendingAnalysis.current, item.id, fingerprint);
    return result;
  }

  async function oneClickFix(item: Creation, args: {
    settings: Settings;
    preserve?: { exactText?: string[]; requiredObjects?: string[]; forbiddenChanges?: string[] };
    issueIds?: string[];
    conversationId?: string | null;
    title?: string;
    includeVision?: boolean;
    videoUrl?: string;
    critiqueProvider?: VisionProvider;
  }) {
    const key = item.id;
    const existing = pendingFix.current.get(key);
    if (existing) return existing as ReturnType<typeof runFix>;
    async function runFix() {
      type PlanResult = {
        kind: string;
        reason?: string;
        plan?: { title: string; sourceId: string; settings: Settings };
        token?: string;
        notice?: string;
      };
      const pending = pendingFixJobs.current.get(key);
      let plan: PlanResult;
      let requestId: string;
      let token: string;
      if (pending) {
        plan = {kind:"ready",plan:pending.plan,token:pending.fixPlanToken,notice:pending.notice};
        requestId = pending.requestId;
        token = pending.fixPlanToken;
      } else {
        plan = await api("/api/fix-plan", {
          creationId: item.id,
          settings: { ...args.settings, batch: 1 },
          preserve: {
            exactText: args.preserve?.exactText ?? [],
            requiredObjects: args.preserve?.requiredObjects ?? [],
            forbiddenChanges: args.preserve?.forbiddenChanges ?? [],
          },
          ...(args.issueIds ? { issueIds: args.issueIds } : {}),
        }) as PlanResult;
        if (plan.kind === "blocked" || plan.kind === "noop") return plan;
        requestId = crypto.randomUUID();
        token = plan.token!;
        pendingFixJobs.current.set(key, {requestId,fixPlanToken:token,plan:plan.plan!,notice:plan.notice});
      }
      try {
        const result = await generate({
          prompt: "Apply the reviewed packaging edits while preserving the original.",
          title: plan.plan!.title,
          conversationId: args.conversationId || undefined,
          parentId: plan.plan!.sourceId,
          mode: "fix",
          settings: plan.plan!.settings,
          fixPlanToken: token,
          requestId,
        });
        pendingFixJobs.current.delete(key);
        const child = result.creations?.[0];
        let scoreFailed = false;
        if (child && !child.score) {
          try {
            await analyze(
              child,
              args.title ?? plan.plan!.title,
              "",
              args.includeVision ?? false,
              args.videoUrl ?? "",
              args.critiqueProvider,
            );
          } catch {
            scoreFailed = true;
          }
        }
        return { ...plan, ...result, scoreFailed };
      } catch (error) {
        if (!(error && typeof error === "object" && unknownOutcomes.has(error))) pendingFixJobs.current.delete(key);
        throw error;
      }
    }
    const work = runFix();
    pendingFix.current.set(key, work);
    try {
      return await work;
    } finally {
      pendingFix.current.delete(key);
    }
  }
  async function saveProfile(kind:"persona"|"style",name:string,notes:string,files:File[],permission=false,source?:{kind:"youtube";channelId:string;videoIds:string[]}){
    const epoch=ownerEpoch.current;
    if(name.trim().length<3)throw new Error("Name must be at least 3 characters");
    if(files.length<(kind==="persona"?2:1)||files.length>3)throw new Error(kind==="persona"?"Upload 2 or 3 photos of this persona.":"Use 1 to 3 style references.");
    if(kind==="persona"&&!permission)throw new Error("Confirm you have permission to use these photos and this likeness.");
    const hashes=await Promise.all(files.map(async file=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).join(",")));
    if(new Set(hashes).size!==files.length)throw new Error("Choose different reference images.");
    const refs:string[]=[];let dispatched=false;
    try{
      for(const file of files){if(epoch!==ownerEpoch.current)throw new Error("Your account changed. Start again in this workspace.");refs.push(await upload(file));}
      if(name.trim().length>80||notes.length>800)throw new Error("Use a name up to 80 characters and guidance up to 800 characters.");const input={kind,name:name.trim(),notes,refs,permission,source};let item:Persona;
      if(cloud){dispatched=true;item=(await api("/api/profiles",input)).profile;}
      else{item={id:crypto.randomUUID(),name:input.name,notes:input.notes,refs,created_at:new Date().toISOString(),profile_status:"draft",...(source?{source}: {})};await localCreateProfile(kind,item);}
      if(epoch!==ownerEpoch.current)throw new Error("Your account changed. The profile remains in its original account.");
      await load();return item;
    }catch(error){if(!dispatched){if(cloud&&refs.length)await db.current!.storage.from("studio-assets").remove(refs);else for(const id of refs)await localDelete("assets",id);}throw error;}
  }
  async function renameProfile(kind:"persona"|"style",id:string,name:string){
    const epoch=ownerEpoch.current;
    if(name.trim().length<3)throw new Error("Name must be at least 3 characters");
    if(name.trim().length>80)throw new Error("Use a name up to 80 characters.");
    const trimmed=name.trim();
    if(cloud){
      const requestHeaders=await headers();
      if(epoch!==ownerEpoch.current)throw new Error("Your account changed.");
      const res=await fetch("/api/profiles",{method:"PATCH",headers:requestHeaders,body:JSON.stringify({kind,id,name:trimmed})});
      const result=await res.json();
      if(epoch!==ownerEpoch.current)throw new Error("Your account changed. The profile remains in its original account.");
      if(!res.ok)throw new Error(result.error||"This profile could not be renamed.");
      await load();
      return result.profile;
    }
    const next=await localRenameProfile<Persona>(kind,id,trimmed);
    if(epoch!==ownerEpoch.current)throw new Error("Your account changed. The profile remains in its original account.");
    await load();
    return next;
  }
  async function importYouTube(videoId:string){const res=await fetch("/api/youtube/reference",{method:"POST",headers:await headers(),body:JSON.stringify({videoId})});if(!res.ok){const e=await res.json();throw new Error(e.error||"This thumbnail could not import.");}return new File([await res.blob()],videoId+".png",{type:"image/png"});}
  async function saveConversation(chat:Conversation,mode:"full"|"draft"|"title"|"selection"="full"){
    const epoch=ownerEpoch.current;
    const operation=chatWrites.current.then(async()=>{
      if(epoch!==ownerEpoch.current||userRef.current!==user)throw new Error("Your account changed.");
      let next=chat;
      if(mode!=="full"){
       const current=cloud?(await db.current!.from("studio_conversations").select("*").eq("id",chat.id).eq("user_id",user).single()).data:(await localAll<Conversation>("conversations")).find(c=>c.id===chat.id);
       if(!current)throw new Error("This chat is no longer available.");
       if(mode==="title")next={...current,title:chat.title,draft:{...current.draft,manualTitle:true},updated_at:chat.updated_at};
       else if(mode==="selection")next={...current,draft:{...current.draft,selection:chat.draft.selection},updated_at:chat.updated_at};
       else next={...current,draft:{...chat.draft,manualTitle:current.draft.manualTitle},title:current.title==="New chat"&&!current.draft.manualTitle&&chat.draft.prompt?.trim()?chat.draft.prompt.trim().slice(0,80):current.title,updated_at:chat.updated_at};
      }
      if(mode==="draft"||mode==="full")next={...next,draft:{...next.draft,draftSavedAt:chat.draft.draftSavedAt??Date.parse(chat.updated_at)}};
      await put("conversations",next);
      if(epoch!==ownerEpoch.current)throw new Error("Your account changed. This chat stays in its original workspace.");
      setConversations(items=>[next,...items.filter(c=>c.id!==next.id)].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)));return next;
    });
    chatWrites.current=operation.then(()=>{},()=>{});return operation;
  }
  async function rememberCreation(item:Creation){
    if(!item.conversation_id)return;
    const chat=cloud?(await db.current!.from("studio_conversations").select("*").eq("id",item.conversation_id).eq("user_id",user).maybeSingle()).data:(await localAll<Conversation>("conversations")).find(c=>c.id===item.conversation_id);
    if(chat)await saveConversation({...chat,draft:{...chat.draft,selection:item.id},updated_at:new Date().toISOString()},"selection");
  }
  async function createConversation(){const now=new Date().toISOString();return saveConversation({id:crypto.randomUUID(),title:"New chat",draft:{},created_at:now,updated_at:now});}
  async function saveTutorialPreference(skip:boolean){const epoch=ownerEpoch.current;if(cloud){const result=await db.current!.from("studio_preferences").upsert({user_id:user,skip_persona_tutorial:skip,updated_at:new Date().toISOString()});if(result.error)throw new Error("Could not save this preference.");}else await localPut("preferences",{id:"local",skip_persona_tutorial:skip});if(epoch===ownerEpoch.current)setSkipPersonaTutorial(skip);}
  async function feedback(creationId:string,body:string){if(body.trim().length<3||body.length>2000)throw new Error("Write between 3 and 2,000 characters.");const item={id:crypto.randomUUID(),creation_id:creationId,body:body.trim(),created_at:new Date().toISOString()};if(cloud){const result=await db.current!.from("studio_feedback").insert({...item,user_id:user});if(result.error)throw new Error("Feedback could not be saved. Your text remains here.");}else await localPut("feedback",item);}
  async function prepare(kind: "persona" | "style", id: string, provider: TextProvider = "openai") {
    requireLive();
    if(!config?.[provider])throw new Error("Connect your selected "+(provider==="openai"?"OpenAI":"Google")+" API key to prepare this profile.");
    const result = await api("/api/persona/prepare", { id, kind, provider });
    await load();
    ensureCurrentOwner();
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
      await rememberCreation(result.creation as Creation);
      await load();
      ensureCurrentOwner();
    ensureCurrentOwner();
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
      lineage:{origin:"layout",nativeOutput:false,sourceId:item.id},
      parent_id: item.id,
      image_path: path,
      settings: { ...(item.settings || defaultSettings), format },
      score: null,
      created_at: new Date().toISOString(),
    };
    await put("creations", copy);
    await rememberCreation(copy);
    await load();
    ensureCurrentOwner();
    return copy;
  }
  async function remove(kind: Collection, id: string) {
    if (cloud) {
      const { error } = await db
        .current!.from("studio_" + kind)
        .delete()
        .eq("id", id);
      if (error) throw new Error("Could not delete this item. Refresh your library to check whether it is still there.");
    } else await localDelete(kind, id);
    await load();
    ensureCurrentOwner();
  }
  async function favorite(item: Creation) {
    await put("creations", { ...item, favorite: !item.favorite });
    await load();
    ensureCurrentOwner();
  }
  async function download(item: Creation) {
    if (!item.image_path)
      throw new Error("This draft has no image yet. Choose Generate before downloading.");
    const url = URL.createObjectURL(await blob(item.image_path));
    const link = document.createElement("a");
    link.href = url;
    link.download = `openpikzel-${item.id}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function login(email: string, password: string) {
    if (!db.current) throw new Error("Cloud sign-in is not available here yet. You can still save drafts in this browser.");
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
    conversations,skipPersonaTutorial,saveConversation,createConversation,saveTutorialPreference,feedback,importYouTube,
    config,
    authClient:db.current,
    user,
    cloud,
    live,
    loading:loading||configStatus==="loading"||!!user&&config?.connectionStatus==="loading"||loadedOwner.current!==user,
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
    oneClickFix,
    saveProfile,
    renameProfile,
    prepare,
    resize,
    remove,
    favorite,
    download,
    login,
    logout,
    api,
    read,
    authHeaders: headers,
    requireLive,
  };
}
