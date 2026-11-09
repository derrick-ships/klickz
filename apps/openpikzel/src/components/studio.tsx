"use client";
import { generationReadiness } from "@/lib/generation-readiness";
import { jobGuidance } from "@/lib/job-state";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  PanelLeft,
  Plus,
  ImagePlus,
  Images,
  UserRoundPlus,
  Users,
  Palette,
  Link2,
  Upload,
  RefreshCw,
  Sparkles,
  ChartNoAxesCombined,
  WandSparkles,
  Pencil,
  Type,
  SlidersHorizontal,
  ArrowUpRight,
  Download,
  Star,
  Trash2,
  X,
  Check,
  ChevronDown,
  Monitor,
  Smartphone,
  Search,
  FolderOpen,
  Settings2,
  LogOut,
  LoaderCircle,
  ArrowLeft,
  Copy,
  ScanLine,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import type { FixPlan } from "@/lib/diagnostics";
import { BrandScene } from "@/components/brand-scene";
import { PixelConfirmation } from "@/components/pixel-confirmation";
import { ReviewCanvas } from "@/components/review-canvas";
import {ModelTrigger,ModelPicker} from "@/components/creative/model-picker";
const AnalysisPanel=dynamic(()=>import("@/components/creative/analysis").then(m=>m.AnalysisPanel),{loading:()=> <p role="status">Opening…</p>});
const ImageInspector=dynamic(()=>import("@/components/creative/image-inspector").then(m=>m.ImageInspector),{loading:()=> <p role="status">Opening image…</p>});
const ProfileManager=dynamic(()=>import("@/components/creative/profiles").then(m=>m.ProfileManager),{loading:()=> <p role="status">Opening…</p>});
const ComparisonSlider=dynamic(()=>import("@/components/creative/comparison").then(m=>m.ComparisonSlider),{loading:()=> <p role="status">Opening…</p>});
const FeedbackForm=dynamic(()=>import("@/components/creative/feedback").then(m=>m.FeedbackForm),{loading:()=> <p role="status">Opening…</p>});
import {OperationProgress} from "@/components/creative/progress";
import {ChatHistory,ChatTitle,ChatTimeline} from "@/components/creative/chat";
import { readDraftCheckpoint, writeDraftCheckpoint } from "@/lib/draft-checkpoint";
import type {Conversation,WorkspaceDraft} from "@/lib/workspaces";
import { useStudio } from "@/lib/use-studio";
import {
  defaultSettings,
  pillars,
  type Creation,
  type Persona,
  type Style,
  type Settings,
  type Mode,
  type Pillar,
} from "@/lib/types";
type Tool = "recreate" | "generate" | "analyze" | "edit" | "title";
type Dialog =
  | "models"
  | "inspect"
  | "analysis"
  | "beforeafter"
  | "feedback"
  | "personas"
  | "styles"
  | "references"
  | "connections"
  | "fixplan"
  | "compare"
  | "jobs"
  | "login"
  | null;
const modes = [
  { id: "recreate", label: "Recreate", icon: RefreshCw },
  { id: "generate", label: "Prompt", icon: ImagePlus },
  { id: "analyze", label: "Analyze", icon: ChartNoAxesCombined },
  { id: "edit", label: "Edit", icon: WandSparkles },
  { id: "title", label: "Title", icon: Type },
] as const;
const names: Record<Pillar, string> = {
  virality: "Virality",
  clarity: "Clarity",
  idea: "Idea",
  curiosity: "Curiosity",
  emotion: "Emotion",
};
const definitions: Record<Pillar, string> = {
  virality: "A visual idea that interrupts the scroll.",
  clarity: "One clear subject, readable at feed size.",
  idea: "The specific promise of your video.",
  curiosity: "A question worth clicking to answer.",
  emotion: "A clear, relevant feeling.",
};
export default function Studio() {
  const studio = useStudio();
  useEffect(() => { try { document.cookie = "openpikzels-entry=studio; Path=/; Max-Age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch { /* Browser privacy settings may block preferences. */ } }, []);
  const [profileDialogTitle,setProfileDialogTitle]=useState("");
  const [activeChatId,setActiveChatId]=useState<string|null>(null),[chatSaveState,setChatSaveState]=useState("");
  const [hydratedWorkspace,setHydratedWorkspace]=useState("");
  const workspaceEpoch=useRef(0);
  const chatCreation=useRef<{owner:string|null;epoch:number;promise:Promise<Conversation>}|null>(null);
  const [pendingResult,setPendingResult]=useState<string|null>(null);
  const hydratedOwner=useRef(""),chatIdRef=useRef<string|null>(null),ownerUI=useRef(studio.user);ownerUI.current=studio.user;chatIdRef.current=activeChatId;
  const [tool, setTool] = useState<Tool>("generate"),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [prompt, setPrompt] = useState(""),
    [title, setTitle] = useState(""),
    [refs, setRefs] = useState<string[]>([]),
    [personaId, setPersonaId] = useState(""),
    [styleId, setStyleId] = useState(""),
    [preset, setPreset] = useState("Auto"),
    [selection, setSelection] = useState<string | null>(null),
    [parentId, setParentId] = useState<string | null>(null),
    [dialog, setDialog] = useState<Dialog>(null),
    [sidebar, setSidebar] = useState(true),
    [motionInput, setMotionInput] = useState<"keyboard" | "pointer">("keyboard"),
    [saveReceipt, setSaveReceipt] = useState(0),
    [compactNavigation, setCompactNavigation] = useState(false),
    [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [titleAction, setTitleAction] = useState<"image" | "ideas">("image"),
    [titles, setTitles] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [phone, setPhone] = useState(false),
    [composerOpen, setComposerOpen] = useState(false),
    [activePillar, setActivePillar] = useState<Pillar>("clarity"),
    [tab, setTab] = useState<"studio" | "library">("studio"),
    [profileNew, setProfileNew] = useState(false),
    [profileName, setProfileName] = useState(""),
    [profileNotes, setProfileNotes] = useState(""),
    [profileFiles, setProfileFiles] = useState<File[]>([]),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [videoBrief, setVideoBrief] = useState(""),
    [includeVision, setIncludeVision] = useState(false),
    [fixReview, setFixReview] = useState<{
      kind: string;
      plan?: FixPlan;
      token?: string;
      notice?: string;
      reason?: string;
    } | null>(null),
    [exactText, setExactText] = useState(""),
    [requiredObjects, setRequiredObjects] = useState(""),
    [forbiddenChanges, setForbiddenChanges] = useState(""),
    [blindPair, setBlindPair] = useState<{
      title: string;
      token: string;
      options: { label: string; preview: string; fullImage: string }[];
      notice: string;
    } | null>(null),
    [reviewResult, setReviewResult] = useState(""),
    [jobs, setJobs] = useState<
      {
        id: string;
        operation: string;
        state: string;
        max_provider_calls: number;
        created_at?: string;
        result?: {creation?: {id:string}; creations?: {id:string}[]};
      }[]
    >([]);
  const dialogRef = useRef<HTMLDialogElement>(null),
    uploadRef = useRef<HTMLInputElement>(null),
    mainRef = useRef<HTMLElement>(null),
    navigationRef = useRef<HTMLElement>(null),
    navigationOpenRef = useRef<HTMLButtonElement>(null),
    navigationCloseRef = useRef<HTMLButtonElement>(null),
    dialogTriggerRef = useRef<HTMLElement | null>(null),
    reviewHeadingRef = useRef<HTMLHeadingElement>(null),
    draftFingerprintRef = useRef("");
  const draftFingerprint = JSON.stringify({ prompt, title, tool, personaId, styleId, preset, refs, settings, parentId });
  draftFingerprintRef.current = draftFingerprint;
  const selected = studio.creations.find((c) => c.id === selection) || null,
    editSource = selected?.image_path ? selected : studio.creations.find(c=>c.id===(selected?.parent_id || parentId) && !!c.image_path) || null,
    persona = studio.personas.find((p) => p.id === personaId),
    styleProfile = studio.styles.find((s) => s.id === styleId),
    score =
      selected?.score && [2, 3].includes(selected.score.version)
        ? selected.score
        : null;
  useEffect(() => {
    const initial = new URL(location.href).searchParams.get("mode");
    if (modes.some((m) => m.id === initial)) setTool(initial as Tool);
  }, []);
  useEffect(() => {
    const media = matchMedia("(max-width: 1024px)");
    const adapt = () => { setCompactNavigation(media.matches); setSidebar(!media.matches); };
    adapt(); media.addEventListener("change", adapt);
    return () => media.removeEventListener("change", adapt);
  }, []);
  useEffect(() => {
    if (compactNavigation && sidebar) navigationCloseRef.current?.focus();
  }, [compactNavigation, sidebar]);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("mode", tool);
    history.replaceState(null, "", url);
  }, [tool]);
  useEffect(() => {
    if (dialog && !dialogRef.current?.open) {
      dialogTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialogRef.current?.showModal();
    } else if (!dialog) dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    setSaveReceipt(0);
    setPendingResult(null);
    setSelection(null);
    setRefs([]);
    setParentId(null);
    setPersonaId("");
    setStyleId("");
  }, [studio.user]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      setMotionInput("keyboard");
      if (dialogRef.current?.open) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault(); setSidebar((x) => !x);
        if (sidebar) requestAnimationFrame(() => navigationOpenRef.current?.focus());
      }
      if (!compactNavigation || !sidebar) return;
      if (e.key === "Escape") {
        e.preventDefault(); setSidebar(false);
        requestAnimationFrame(() => navigationOpenRef.current?.focus());
      }
      if (e.key === "Tab") {
        const items = navigationRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    addEventListener("keydown", listener);
    return () => removeEventListener("keydown", listener);
  }, [compactNavigation, sidebar]);
  useEffect(() => { setSaveReceipt(0); }, [draftFingerprint]);
  useEffect(() => {
    if (!saveReceipt) return;
    const timer = setTimeout(() => setSaveReceipt(0), 2800);
    return () => clearTimeout(timer);
  }, [saveReceipt]);
  const busy = !!studio.busy;
  const navigating=["Opening chat","Starting a new chat","Opening creation"].includes(studio.busy||"");
  const activeChat=studio.conversations.find(c=>c.id===activeChatId)||null;
  function activateChat(chat:Conversation,focus=true){
    workspaceEpoch.current++;
    const d=chat.draft;chatIdRef.current=chat.id;setActiveChatId(chat.id);localStorage.setItem("openpikzels.activeChat."+(studio.user||"local"),chat.id);
    setPrompt(d.prompt||"");setTitle(d.title||"");setTool(modes.some(m=>m.id===d.tool)?d.tool as Tool:"generate");
    setSettings({...defaultSettings,...d.settings,batch:1});setRefs(d.refs||[]);setPersonaId(d.personaId||"");setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setTitleAction(d.titleAction||"image");setIncludeVision(!!d.includeVision);
    const latest=studio.creations.find(c=>c.conversation_id===chat.id&&c.id===d.selection)||studio.creations.find(c=>c.conversation_id===chat.id);
    setSelection(latest?.id||null);setParentId(latest?.image_path?latest.id:latest?.parent_id||d.parentId||null);setComposerOpen(!latest?.image_path);setTab("studio");setTitles([]);setChatSaveState("");
    if(compactNavigation){setSidebar(false);if(focus)requestAnimationFrame(()=>mainRef.current?.focus());}
  }
  async function ensureChat(){
    const current=studio.conversations.find(c=>c.id===chatIdRef.current);
    if(current)return current;
    const owner=studio.user,epoch=workspaceEpoch.current,startingChat=chatIdRef.current,initialDraft={...chatDraftRef.current,draftSavedAt:Date.now()};
    if(chatCreation.current?.owner===owner&&chatCreation.current.epoch===epoch)return chatCreation.current.promise;
    const promise=studio.createConversation().then(async chat=>{
      if(ownerUI.current!==owner)throw new Error("Your account changed. Open your current workspace again.");
      const saved={...chat,title:initialDraft.prompt?.trim().slice(0,80)||chat.title,draft:initialDraft,updated_at:new Date().toISOString()};
      await studio.saveConversation(saved,"draft");
      if(ownerUI.current===owner&&workspaceEpoch.current===epoch&&chatIdRef.current===startingChat){
        chatIdRef.current=chat.id;setActiveChatId(chat.id);
        localStorage.setItem("openpikzels.activeChat."+(owner||"local"),chat.id);
        writeDraftCheckpoint(localStorage,owner||"local",{chatId:chat.id,draft:chatDraftRef.current});
      }
      return saved;
    });
    chatCreation.current={owner,epoch,promise};
    try{return await promise;}finally{if(chatCreation.current?.promise===promise)chatCreation.current=null;}
  }
  async function selectProfile(kind:"persona"|"style",id:string){const owner=studio.user,startingChat=chatIdRef.current,chat=await ensureChat();await studio.saveConversation({...chat,draft:{...chatDraft,...(kind==="persona"?{personaId:id}:{styleId:id})},updated_at:new Date().toISOString()},"draft");if(ownerUI.current===owner&&(chatIdRef.current===chat.id||chatIdRef.current===startingChat)){if(kind==="persona")setPersonaId(id);else setStyleId(id);}}
  async function flushDraft(){
    const owner=studio.user,draft={...chatDraftRef.current,draftSavedAt:Date.now()};
    const meaningful=!!(draft.prompt?.trim()||draft.title?.trim()||draft.videoBrief?.trim()||draft.refs?.length||draft.personaId||draft.styleId||draft.selection);
    if(!activeChat&&!meaningful)return;
    const chat=activeChat||await ensureChat();
    if(ownerUI.current===owner)await studio.saveConversation({...chat,draft,updated_at:new Date().toISOString()},"draft");
  }
  async function openChat(chat:Conversation){if(busy||chat.id===chatIdRef.current)return;await studio.run("Opening chat",async()=>{const owner=studio.user;await flushDraft();if(ownerUI.current===owner)activateChat(chat);});}
  async function newChat(){if(busy)return;await studio.run("Starting a new chat",async()=>{await flushDraft();const chat=await studio.createConversation();activateChat(chat);startNew();});}
  useEffect(()=>{workspaceEpoch.current++;setActiveChatId(null);chatCreation.current=null;setHydratedWorkspace("");hydratedOwner.current="";setPrompt("");setTitle("");setVideoBrief("");setTitles([]);setBlindPair(null);setReviewResult("");setFixReview(null);setJobs([]);setDialog(null);setChatSaveState("");},[studio.user]);
  useEffect(()=>{
    if(studio.loading)return;const key=studio.user||"local";if(hydratedOwner.current===key)return;hydratedOwner.current=key;
    const saved=localStorage.getItem("openpikzels.activeChat."+key),chat=studio.conversations.find(c=>c.id===saved),checkpoint=readDraftCheckpoint(localStorage,key);
    if(chat)activateChat(checkpoint?.chatId===chat.id&&checkpoint.savedAt>=(chat.draft.draftSavedAt||0)?{...chat,draft:checkpoint.draft}:chat,false);
    else if(checkpoint&&!checkpoint.chatId){
      const d=checkpoint.draft;setPrompt(d.prompt||"");setTitle(d.title||"");setTool((d.tool||"generate") as Tool);setSettings({...defaultSettings,...d.settings});
      setRefs(d.refs||[]);setPersonaId(d.personaId||"");setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setParentId(d.parentId||null);setTitleAction(d.titleAction||"image");setIncludeVision(!!d.includeVision);
    }
    setHydratedWorkspace(key);
  },[studio.loading,studio.user,studio.conversations]);
  const chatDraft:WorkspaceDraft={prompt,title,tool,settings,refs,personaId,styleId,preset,videoBrief,selection,parentId,titleAction,includeVision};
  const chatDraftRef=useRef(chatDraft);chatDraftRef.current=chatDraft;
  const chatDraftJSON=JSON.stringify(chatDraft);
  useEffect(()=>{
    const owner=studio.user,key=owner||"local";
    if(studio.loading||hydratedWorkspace!==key)return;
    const draft={...JSON.parse(chatDraftJSON),draftSavedAt:Date.now()} as WorkspaceDraft;
    const meaningful=!!(draft.prompt?.trim()||draft.title?.trim()||draft.videoBrief?.trim()||draft.refs?.length||draft.personaId||draft.styleId||draft.selection||draft.preset!=="Auto"||JSON.stringify(draft.settings)!==JSON.stringify(defaultSettings));
    if(!activeChatId&&!meaningful)return;
    const checkpointSaved=writeDraftCheckpoint(localStorage,key,{chatId:activeChatId,draft});
    setChatSaveState(checkpointSaved?"Saved on this device · syncing…":"Saving draft…");
    let cancelled=false;
    const timer=setTimeout(()=>{
      void (async()=>{
        const chat=activeChat||await ensureChat();
        if(cancelled||ownerUI.current!==owner||chatIdRef.current!==chat.id)return;
        await studio.saveConversation({...chat,title:chat.title==="New chat"&&draft.prompt?.trim()?draft.prompt.trim().slice(0,80):chat.title,draft,updated_at:new Date().toISOString()},"draft");
        if(!cancelled&&ownerUI.current===owner&&chatIdRef.current===chat.id)setChatSaveState(studio.cloud?"Saved to your workspace":"Saved on this device");
      })().catch(()=>{if(!cancelled&&ownerUI.current===owner)setChatSaveState(checkpointSaved?"Saved on this device. Workspace sync failed.":"Draft not saved. Keep this page open.");});
    },300);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[activeChatId,chatDraftJSON,studio.user,studio.loading,hydratedWorkspace]);

  const changeSettings = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  function openProfiles(which: "personas" | "styles") {
    setProfileDialogTitle(which==="personas"?"Your personas":"Your styles");
    setProfileNew(false);
    setProfileName("");
    setProfileNotes("");
    setProfileFiles([]);
    setDialog(which);
  }
  async function choose(item:Creation){
    if(busy)return false;
    const changed=await studio.run("Opening creation",async()=>{
      const owner=studio.user;await flushDraft();if(ownerUI.current!==owner)return false;
      if((item.conversation_id||null)!==activeChatId){
       const chat=studio.conversations.find(c=>c.id===item.conversation_id);
       if(chat)activateChat(chat,false);
       else{workspaceEpoch.current++;chatIdRef.current=null;setActiveChatId(null);setPrompt("");setRefs([]);setPersonaId("");setStyleId("");setVideoBrief("");setPreset("Auto");localStorage.removeItem("openpikzels.activeChat."+(owner||"local"));}
      }
      setParentId(item.image_path?item.id:item.parent_id);
      setComposerOpen(false);setSaveReceipt(0);setSelection(item.id);setTitle(item.title);
      if(item.settings)setSettings({...defaultSettings,...item.settings,batch:1});setTab("studio");
      if(compactNavigation){setSidebar(false);requestAnimationFrame(()=>mainRef.current?.focus());}
      return true;
    });return changed===true;
  }
  async function resume(item: Creation) {
    if(!await choose(item))return;
    setComposerOpen(true);
    setPrompt(item.prompt);
    setTool(
      ["generate", "recreate", "edit", "title"].includes(item.mode)
        ? (item.mode as Tool)
        : "generate",
    );
    setParentId(item.image_path ? item.id : item.parent_id);
    setRefs(
      item.reference_paths ||
        [item.reference_path].filter((p): p is string => !!p),
    );
    setPersonaId(item.persona_id || "");
    setStyleId(item.style_id || "");
    setPreset(item.style);
  }
  function startNew() {
    setComposerOpen(false);
    setSaveReceipt(0);
    setSelection(null);
    setParentId(null);
    setPrompt("");
    setTitle("");
    setRefs([]);
    setTitles([]);
    setTab("studio");
    studio.setError("");
    if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); }
  }
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    await studio.run("Uploading references", async () => {
      if (refs.length + files.length > 6)
        throw new Error("Use up to six image references.");
      const added: string[] = [];
      for (const file of Array.from(files))
        added.push(await studio.upload(file));
      setRefs((r) => [...r, ...added]);
      if (["analyze", "edit"].includes(tool)) {
        const item = await studio.saveUploaded(
          added[0],
          title || "Uploaded thumbnail",
          (await ensureChat()).id,
        );
        setSelection(item.id);
        setComposerOpen(true);
      }
      await studio.load();
    });
  }
  async function importLink() {
    await studio.run("Importing reference", async () => {
      if (refs.length >= 6) throw new Error("Use up to six references.");
      const path = await studio.importReference(url);
      setRefs((r) => [...r, path]);
      setUrl("");
      setLinkOpen(false);
      if (["analyze", "edit"].includes(tool)) {
        const item = await studio.saveUploaded(
          path,
          title || "Imported thumbnail",
          (await ensureChat()).id,
        );
        setSelection(item.id);
        setComposerOpen(true);
      }
      await studio.load();
    });
  }
  function payload(mode: Mode = tool === "analyze" ? "generate" : tool) {
    const text =
      tool === "title"
        ? `Create a thumbnail for the video titled: ${title}. ${prompt}`
        : prompt;
    return {
      conversationId: activeChatId,
      prompt: text.trim(),
      title,
      mode,
      style: styleProfile?.name || preset,
      personaId: personaId || null,
      styleId: styleId || null,
      parentId:
        mode === "edit" || mode === "fix"
          ? (editSource?.id || null)
          : null,
      referencePath: refs[0] || null,
      referencePaths: refs,
      settings,
      requestId: crypto.randomUUID(),
    };
  }
  async function submit() {
    const submittedFingerprint=draftFingerprint;
    await studio.run(
      tool === "analyze"
        ? "Analyzing thumbnail"
        : tool === "title" && titleAction === "ideas"
          ? "Finding title angles"
          : `Generating ${settings.batch} thumbnail${settings.batch > 1 ? "s" : ""}`,
      async () => {
        if (tool === "analyze") {
          if (!selected?.image_path)
            throw new Error(
              "Upload a thumbnail or choose one from your library.",
            );
          await studio.analyze(selected, title, videoBrief, includeVision);
          setComposerOpen(false);
          setDialog("analysis");
          requestAnimationFrame(() => reviewHeadingRef.current?.focus());
          return;
        }
        if (tool === "title" && titleAction === "ideas") {
          studio.requireLive();
          const result = await studio.api("/api/titles", {
            prompt: prompt || title,
            audience: "YouTube viewers",
          });
          setTitles(result.titles);
          return;
        }
        const chat=await ensureChat();
        const input = {...payload(),conversationId:chat.id};
        if (input.prompt.length < 8)
          throw new Error(
            "Describe your thumbnail in at least eight characters.",
          );
        if (tool === "recreate" && !refs.length)
          throw new Error("Add a thumbnail reference to recreate.");
        if (tool === "edit" && !editSource?.image_path && !refs.length)
          throw new Error("Choose an image to edit.");
        const result = await studio.generate(input);
        if(draftFingerprintRef.current===submittedFingerprint){
          setSelection(result.creations[0].id);setTitle(result.creations[0].title);setComposerOpen(false);
          requestAnimationFrame(() => reviewHeadingRef.current?.focus());
        }else{
          setPendingResult(result.creations[0].id);
          await studio.saveConversation({...chat,draft:chatDraftRef.current,updated_at:new Date().toISOString()},"draft");
        }
        if (result.partial)
          studio.setError(
            "Some images were saved, but the batch stopped. Check My creations before generating again to avoid duplicate charges.",
          );
      },
    );
  }
  async function saveDraft() {
    const savingFingerprint = draftFingerprint;
    setSaveReceipt(0);
    await studio.run("Saving draft", async () => {
      const chat=await ensureChat();
      const input = payload();
      const item = await studio.saveDraft({
        conversationId:chat.id,
        prompt: input.prompt,
        title,
        mode: input.mode,
        style: input.style,
        personaId,
        styleId,
        referencePaths: refs,
        settings,
        parentId: input.parentId,
      });
      const unchanged = draftFingerprintRef.current === savingFingerprint;
      await studio.saveConversation({...chat,draft:{...chatDraftRef.current,...(unchanged ? {selection:item.id} : {})},updated_at:new Date().toISOString()},"draft");
      if (draftFingerprintRef.current === savingFingerprint) {
        setSelection(item.id);
        setSaveReceipt((receipt) => receipt + 1);
      } else if (unchanged) {
        await studio.saveConversation({...chat,draft:chatDraftRef.current,updated_at:new Date().toISOString()},"draft");
      }
    });
  }
  async function fix() {
    if (!selected) return;
    setFixReview(null);
    setExactText("");
    setRequiredObjects("");
    setForbiddenChanges("");
    setDialog("fixplan");
  }
  async function prepareFix() {
    if (!selected) return;
    await studio.run("Preparing fix plan", async () => {
      const list = (s: string) =>
        s
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
      const r = await studio.api("/api/fix-plan", {
        creationId: selected.id,
        settings: { ...settings, batch: 1 },
        preserve: {
          exactText: list(exactText),
          requiredObjects: list(requiredObjects),
          forbiddenChanges: list(forbiddenChanges),
        },
      });
      setFixReview(r);
    });
  }
  async function applyFix() {
    if (!fixReview?.plan || !fixReview.token) return;
    await studio.run("Applying reviewed fix", async () => {
      const plan = fixReview.plan!;
      const result = await studio.generate({
        prompt:
          "Apply the reviewed packaging edits while preserving the original.",
        title: plan.title,
        conversationId: activeChatId,
        parentId: plan.sourceId,
        mode: "fix",
        settings: plan.settings,
        fixPlanToken: fixReview.token,
        requestId: crypto.randomUUID(),
      });
      setSelection(result.creations[0].id);
      setDialog(null);
    });
  }
  async function compare() {
    if (!selected) return;
    await studio.run("Preparing blind comparison", async () => {
      setBlindPair(
        await studio.api("/api/compare", { creationId: selected.id }),
      );
      setReviewResult("");
      setDialog("compare");
    });
  }
  async function decideComparison(preference: string) {
    if (!blindPair) return;
    await studio.run("Saving review", async () => {
      const result = await studio.api("/api/compare", {
        token: blindPair.token,
        preference,
      });
      setReviewResult(
        result.keptOriginal
          ? "Keep the original, or review again later. Both versions remain saved."
          : "You preferred the new variant. Both versions remain saved; check identity, facts and wording before export.",
      );
      await studio.load();
    });
  }
  async function showJobs() {
    await studio.run("Loading jobs", async () => {
      const owner=studio.user;
      const r = await fetch("/api/jobs", {
        headers: await studio.authHeaders(),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      if(ownerUI.current!==owner)return;
      await studio.load();
      if(ownerUI.current!==owner)return;
      setJobs(value.jobs);
      setDialog("jobs");
    });
  }
  async function resize() {
    if (!selected) return;
    await studio.run("Resizing thumbnail", async () => {
      const copy = await studio.resize(
        selected,
        selected.settings?.format === "short" ? "long" : "short",
      );
      setSelection(copy.id);
      setSettings(copy.settings || defaultSettings);
    });
  }
  async function deleteCreation(item: Creation) {
    if (!confirm("Delete this creation from your library?")) return;
    await studio.run("Deleting creation", async () => {
      await studio.remove("creations", item.id);
      if (selection === item.id) setSelection(null);
    });
  }
  const filtered = studio.creations.filter(
    (c) =>
      (!onlyFavorites || c.favorite) &&
      `${c.title} ${c.prompt}`.toLowerCase().includes(search.toLowerCase()),
  );
  function openReviewEditor(mode: "edit" | "analyze") {
    if (!selected) return;
    setComposerOpen(true);
    setTool(mode);
    if (mode === "edit") { setParentId(selected.id); }
    else setTitle(selected.title);
    requestAnimationFrame(() => {
      document.getElementById(mode === "analyze" ? "video-title" : "thumbnail-prompt")?.focus({ preventScroll: true });
      document.querySelector(".creation-workbench")?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  function restoreDialogFocus() {
    requestAnimationFrame(() => {
      if (dialogRef.current?.open) return;
      const trigger = dialogTriggerRef.current;
      if (trigger?.isConnected && !trigger.closest("[inert]") && trigger.getClientRects().length && getComputedStyle(trigger).visibility === "visible") trigger.focus();
      else (navigationOpenRef.current || mainRef.current)?.focus();
    });
  }
  const hasReviewImage = !!(selected?.image_path && studio.images[selected.image_path]);
  const showComposer = !hasReviewImage || composerOpen;
  const readiness = generationReadiness({config:studio.config,cloud:studio.cloud,loading:studio.loading,tool,titleIdeas:tool==="title"&&titleAction==="ideas",settings,prompt,title,hasSource:!!(tool==="edit"?editSource?.image_path:selected?.image_path),hasReferences:refs.length>0,includeVision});
  const ResultHeading = hasReviewImage ? "h1" : "h2";
  const ComposerHeading = hasReviewImage ? "h2" : "h1";
  const resultPanel = selected ? (
<section className={`result-section ${hasReviewImage ? "review-stage" : ""}`} aria-label={hasReviewImage ? "Thumbnail review studio" : "Saved concept"}>
                  <div className={`section-heading ${hasReviewImage ? "review-summary" : ""}`}>
                    <div>
                      <ResultHeading ref={hasReviewImage ? reviewHeadingRef : undefined} tabIndex={hasReviewImage ? -1 : undefined}>
                        {selected.status === "draft"
                          ? "Concept saved."
                          : selected.mode === "fix"
                            ? "New version saved."
                            : selected.mode === "resize"
                              ? "Ready for another format."
                              : "Your thumbnail."}
                      </ResultHeading>
                      <p>{selected.title}</p>
                    </div>
                    <div className="result-utilities">
                      {hasReviewImage && (
                      <button
                        className={phone ? "icon-button active" : "icon-button"}
                        aria-label="Toggle phone feed preview" aria-pressed={phone}
                        onClick={() => setPhone((x) => !x)}
                      >
                        <Smartphone size={16} /><span>Feed preview</span>
                      </button>
                      )}
                      <button
                        className={
                          selected.favorite
                            ? "icon-button favorited"
                            : "icon-button"
                        }
                        aria-label="Favorite selected creation" aria-pressed={selected.favorite}
                        onClick={() =>
                          studio.run("Saving favorite", () =>
                            studio.favorite(selected),
                          )
                        }
                      >
                        <Star
                          size={16}
                          fill={selected.favorite ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="review-layout"><div className="review-media">
                  {selected.image_path && studio.images[selected.image_path] ? (
                    <>
                      <ReviewCanvas key={studio.images[selected.image_path]} src={studio.images[selected.image_path]} title={selected.title} feed={phone} pointer={motionInput === "pointer"} portrait={selected.settings?.format === "short"} onRefresh={() => studio.run("Refreshing preview", studio.load)} />
                      <div className="result-actions">
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={() => openReviewEditor("edit")}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={() => openReviewEditor("analyze")}
                        >
                          <ChartNoAxesCombined size={15} />
                          Analyze
                        </button>
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={resize}
                        >
                          {selected.settings?.format === "short" ? (
                            <RectangleHorizontal size={15} />
                          ) : (
                            <RectangleVertical size={15} />
                          )}
                          Resize to{" "}
                          {selected.settings?.format === "short"
                            ? "long-form"
                            : "short-form"}
                        </button>
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={() =>
                            studio.run("Downloading image", () =>
                              studio.download(selected),
                            )
                          }
                        >
                          <Download size={15} />
                          Download
                        </button>
                      </div>
                      <div className="image-secondary-actions"><button className="quiet-button" onClick={()=>setDialog("inspect")}>Inspect image</button><button className="quiet-button" disabled={busy||!selected.parent_id} onClick={()=>setDialog("beforeafter")}>Compare before &amp; after</button><button className="quiet-button" disabled={busy} onClick={()=>{setRefs([selected.image_path!]);setTool("recreate");setComposerOpen(true);}}>Recreate this thumbnail</button><button className="quiet-button" onClick={()=>setDialog("feedback")}>Leave feedback</button></div>
                      <details className="provenance-details"><summary>Prompt and generation details</summary><dl><dt>Exact request</dt><dd>{selected.prompt}</dd><dt>Model / quality / format</dt><dd>{selected.settings?.model||"Uploaded image"} · {selected.settings?.quality||"Original"} · {selected.settings?.format||"Source format"}</dd><dt>References</dt><dd>{selected.reference_paths?.length||0} image references · {selected.persona_id?"Persona selected":"No Persona"} · {selected.style_id?"Private Style selected":selected.style}</dd><dt>Saved</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></dl></details>
                      <p className="resize-note">
                        Resize keeps the full image and fills the extra space
                        with a soft background. It does not use AI credits.
                      </p>
                    </>
                  ) : (
                    <div className="draft-preview">
                      <ImagePlus size={28} />
                      <p>{selected.prompt}</p>
                      <span>
                        {selected.status === "draft"
                          ? (readiness.action==="signin"?"Your instructions are saved on this device. Sign in to generate when you are ready.":readiness.action==="connect"?"Your instructions are saved. Connect your "+readiness.provider+" API key to generate.":"Your instructions are saved. Generate an image with your connected API credits when you are ready.")
                          : selected.status === "failed"
                            ? "This image did not finish generating. Your instructions are saved; check My creations before retrying."
                            : "This image is still processing. Check My creations before starting another request."}
                      </span>
                      <button
                        className="neutral-button"
                        onClick={() => resume(selected)}
                      >
                        Continue editing
                      </button>
                    </div>
                  )}
                  {selected.mode === "fix" && selected.parent_id && (
                    <div className="original-link">
                      <button
                        onClick={() => {
                          const original = studio.creations.find(
                            (c) => c.id === selected.parent_id,
                          );
                          if (original) choose(original);
                        }}
                      >
                        <ArrowLeft size={14} />
                        View original thumbnail
                      </button>
                      <span>Your original is preserved.</span>
                      <button
                        className="neutral-button"
                        disabled={busy}
                        onClick={compare}
                      >
                        Compare without scores
                      </button>
                    </div>
                  )}
                  </div>
                  {score ? (
                    <aside className="score-panel review-inspector" aria-label="Scoring inspector">
                      <div className="score-header">
                        <div>
                          <span>OpenPikzels Score</span>
                          <h2>
                            {score.overall ?? "Partial"}
                            {score.overall !== null && <small>/100</small>}
                          </h2>
                          <p>Thumbnail + title, across five pillars.</p><button className="quiet-button" onClick={()=>setDialog("analysis")}>Open analysis details</button>
                        </div>
                        <button
                          className="primary-button fix-button"
                          disabled={busy}
                          onClick={fix}
                        >
                          <WandSparkles size={16} />
                          One-click fix
                        </button>
                      </div>
                      <div className="score-body">
                        <div className="pillar-list">
                          {pillars.map((p) => (
                            <button
                              key={p}
                              className={
                                activePillar === p ? "pillar active" : "pillar"
                              }
                              aria-pressed={activePillar === p}
                              onClick={() => setActivePillar(p)}
                            >
                              <span>{names[p]}</span>
                              <strong>
                                {score.dimensions[p].score ?? "Not assessed"}
                                {score.dimensions[p].score !== null && (
                                  <small>/100</small>
                                )}
                              </strong>
                              {score.dimensions[p].score !== null && (
                                <progress
                                  aria-label={`${names[p]} score`}
                                  max={100}
                                  value={score.dimensions[p].score!}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="pillar-detail">
                          <h3>{names[activePillar]}</h3>
                          <p>
                            {score.dimensions[activePillar].missingReason ||
                              score.dimensions[activePillar].observation}
                          </p>
                          <dl>
                            <dt>Working for you</dt>
                            <dd>{score.dimensions[activePillar].strength}</dd>
                            <dt>Holding it back</dt>
                            <dd>{score.dimensions[activePillar].weakness}</dd>
                            <dt>What to change</dt>
                            <dd>{score.dimensions[activePillar].fix}</dd>
                          </dl>
                          <span className="confidence">
                            AI confidence:{" "}
                            {score.dimensions[activePillar].confidence >= 0.7
                              ? "high"
                              : score.dimensions[activePillar].confidence >= 0.3
                                ? "medium"
                                : "low"}{" "}
                            (not a measured probability)
                          </span>
                        </div>
                      </div>
                      {score.warnings?.map((w) => (
                        <p className="score-disclaimer" key={w}>
                          {w}
                        </p>
                      ))}
                      <p className="score-disclaimer">
                        {score.note} Jev visual scoring is experimental.
                      </p>
                    </aside>
                  ) : hasReviewImage ? (
                    <aside className="review-inspector review-inspector--empty" aria-label="Scoring inspector">
                      <h2>Review the packaging</h2>
                      <p>Analyze this image with its video title to review the five pillars.</p>
                      <ul>{pillars.map((pillar) => <li key={pillar}>{names[pillar]}</li>)}</ul>
                      <button className="neutral-button" onClick={() => openReviewEditor("analyze")}>Open analysis</button>
                      <p className="score-disclaimer">Analysis uses your connected API credits. Scores are visual estimates, not measured CTR.</p>
                    </aside>
                  ) : null}
                  </div>
                </section>
  ) : null;
  const profileKind = dialog === "personas" ? "persona" : "style",
    profileItems = dialog === "personas" ? studio.personas : studio.styles;
  return (
    <div
      className={`app-shell ${sidebar ? "sidebar-open" : ""}`}
      data-motion-input={motionInput}
      onPointerDownCapture={() => setMotionInput("pointer")}
    >
      <a className="skip-link" href="#studio-content">Skip to studio</a>
      {(
        <button
          className="sidebar-scrim"
          tabIndex={-1}
          aria-hidden={!compactNavigation || !sidebar}
          inert={!compactNavigation || !sidebar}
          onClick={() => { setSidebar(false); requestAnimationFrame(() => navigationOpenRef.current?.focus()); }}
          aria-label="Close navigation"
        />
      )}
      <aside ref={navigationRef} className="sidebar" inert={!sidebar} aria-label="Workspace navigation">
        <div className="sidebar-heading">
          <a className="wordmark" href="/studio">
            OpenPikzels
            <span className="wordmark-pixel" />
          </a>
          <button
            className="icon-button"
            onClick={() => { setSidebar(false); requestAnimationFrame(() => navigationOpenRef.current?.focus()); }}
            ref={navigationCloseRef}
            aria-label="Close sidebar"
          >
            <PanelLeft size={17} />
          </button>
        </div>
        <button className="new-chat neutral-button" disabled={busy} onClick={newChat}>
          <Plus size={16} />
          New chat
        </button>
        <div className="history-controls">
          <button
            className={tab === "library" ? "active" : ""}
            disabled={busy}
            onClick={() => { setTab("library"); if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); } }}
          >
            <FolderOpen size={14} />
            My creations
          </button>
          <button
            className="icon-button"
            aria-label="Show favorites"
            aria-pressed={onlyFavorites}
            onClick={() => {
              setOnlyFavorites((x) => !x);
              setTab("library");
              if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); }
            }}
          >
            <Star size={14} />
          </button>
        </div>
        <div className="history-list">
          <ChatHistory chats={studio.conversations} creations={studio.creations} active={activeChatId} busy={busy} onOpen={chat=>{void openChat(chat);}}/>
          {studio.creations.some(c=>!c.conversation_id)&&<p className="legacy-history-label">Recent creations</p>}
          {studio.creations.filter(c=>!c.conversation_id).slice(0,8).map(item=><button key={item.id} className={"history-item "+(selection===item.id?"selected":"")} disabled={busy} onClick={()=>item.status==="draft"?resume(item):choose(item)}>{item.image_path&&studio.images[item.image_path]?<img src={studio.images[item.image_path]} alt=""/>:<ImagePlus size={16}/>}<span>{item.title}</span></button>)}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-account">
            <span className="avatar">O</span>
            <div>
              <strong>Your workspace</strong>
              <small>
                {studio.cloud ? "Private cloud library" : "Local library"}
              </small>
            </div>

          </div>
          <div className="profile-shortcuts">
            <button onClick={() => openProfiles("personas")}>
              <Users size={16} />
              Personas
            </button>
            <button onClick={() => openProfiles("styles")}>
              <Palette size={16} />
              Styles
            </button>
          </div>
          <p className="sidebar-workspace-status">{studio.cloud ? "Workspace signed in" : "Drafts saved on this device"}</p>
        </div>
      </aside>
      <div className="workspace-main" inert={compactNavigation && sidebar}>
        <header className="topbar">
          <div className="topbar-left">
            {!sidebar && (
              <button
                className="icon-button"
                onClick={() => setSidebar(true)}
                ref={navigationOpenRef}
                aria-label="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <span className="workspace-name">
              {sidebar ? "Personal studio" : "OpenPikzels"}
            </span>
            <span className="topbar-divider" />
            <span className="topbar-caption">Your next great thumbnail.</span>
          </div>
          <div className="topbar-actions">
            <button
              className="quiet-button"
              onClick={() => setDialog("connections")}
            >
              <SlidersHorizontal size={15} />
              <span>Connections</span>
            </button>
            {!studio.cloud && (
              <button
                className="neutral-button login-button"
                onClick={() => setDialog("login")}
              >
                Sign in
              </button>
            )}
          </div>
        </header>
        <main
          id="studio-content"
          tabIndex={-1}
          ref={mainRef}
          className={tab === "library" ? "library-main" : `studio-main ${hasReviewImage ? "review-active" : ""}`}
        >
          {pendingResult&&<div className="result-ready" role="status"><span>Your new thumbnail is ready. Your current draft is unchanged.</span><button className="neutral-button" onClick={async()=>{const item=studio.creations.find(c=>c.id===pendingResult);if(item&&await choose(item))setPendingResult(null);}}>View result</button></div>}
          {dialog === "login" && (
            <p className="dialog-footnote">
              New here?{" "}
              <a href="/connect">Create an account and connect your keys</a>
            </p>
          )}
          {activeChat&&<><ChatTitle key={activeChat.id} title={activeChat.title} busy={busy} onSave={async name=>{await studio.saveConversation({...activeChat,title:name,updated_at:new Date().toISOString()},"title");}}/><span className="chat-save-state" role="status">{chatSaveState}</span></>}
          {busy&&<OperationProgress label={studio.busy}/>}
          {studio.error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              <p>{studio.error}</p>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => studio.setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {tab === "studio" ? (
            <>
              {hasReviewImage && resultPanel}
              {activeChatId&&<ChatTimeline items={studio.creations.filter(c=>c.conversation_id===activeChatId)} images={studio.images} active={selection} onChoose={c=>c.status==="draft"?resume(c):choose(c)}/>}
              <section
                className={`creation-workbench ${hasReviewImage ? "creation-workbench--review" : ""}`}
                aria-label="Thumbnail workspace"
                aria-busy={busy}
              >
                <div className="workbench-heading">
                  <ComposerHeading>
                    {hasReviewImage ? "Creation controls" : tool === "analyze"
                      ? "What’s holding it back?"
                      : tool === "edit"
                        ? "Make it exactly right."
                        : tool === "title"
                          ? "Start with a great title."
                          : "What will you create?"}
                  </ComposerHeading>
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="Creation mode"
                  >
                    {modes.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        role="tab"
                        disabled={navigating}
                        aria-selected={tool === id}
                        tabIndex={tool === id ? 0 : -1}
                        onKeyDown={(event) => {
                          const index = modes.findIndex((mode) => mode.id === id);
                          const next = event.key === "ArrowRight" ? (index + 1) % modes.length
                            : event.key === "ArrowLeft" ? (index + modes.length - 1) % modes.length
                            : event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : -1;
                          if (next < 0) return;
                          event.preventDefault();
                          setTool(modes[next].id);
                          if (hasReviewImage) setComposerOpen(true);
                          setTitles([]);
                          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                        }}
                        className={tool === id ? "active" : ""}
                        onClick={() => {
                          setTool(id);
                          if (hasReviewImage) setComposerOpen(true);
                          setTitles([]);
                        }}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {!selected &&
                  studio.creations.length === 0 && (
                    <BrandScene scene="signal" compact />
                  )}
                {hasReviewImage && <button className="quiet-button review-editor-toggle" aria-expanded={showComposer} aria-controls="review-creation-controls" onClick={() => setComposerOpen((open) => !open)}>{showComposer ? "Hide prompt and settings" : "Show prompt and settings"}<ChevronDown size={14} /></button>}
                <div className="composer" id="review-creation-controls" hidden={!showComposer}>
                  <fieldset className="composer-inner" disabled={navigating} aria-label="Thumbnail inputs">
                    {tool === "title" && (
                      <div className="output-choice">
                        <button
                          className={titleAction === "image" ? "active" : ""}
                          onClick={() => setTitleAction("image")}
                        >
                          <ImagePlus size={14} />
                          Thumbnail from title
                        </button>
                        <button
                          className={titleAction === "ideas" ? "active" : ""}
                          onClick={() => setTitleAction("ideas")}
                        >
                          <Type size={14} />
                          Title ideas
                        </button>
                      </div>
                    )}
                    {(tool === "recreate" ||
                      tool === "analyze" ||
                      tool === "edit") && (
                      <div className={"source-input "+(tool==="edit"&&editSource?.image_path?"source-input--editing":"")}>
                        <div className="source-tabs">
                          <button
                            className={!linkOpen ? "active" : ""}
                            onClick={() => {
                              setLinkOpen(false);
                              uploadRef.current?.click();
                            }}
                          >
                            <Upload size={14} />
                            Upload
                          </button>
                          <button
                            className={linkOpen ? "active" : ""}
                            onClick={() => setLinkOpen(true)}
                          >
                            <Link2 size={14} />
                            Link
                          </button>
                          <button onClick={() => setDialog("references")}>
                            <Images size={14} />
                            Library
                          </button>
                        </div>
                        {linkOpen ? (
                          <div className="link-input">
                            <input
                              aria-label="Reference URL"
                              value={url}
                              onChange={(e) => setUrl(e.target.value)}
                              placeholder="Link to an image or a YouTube video"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  importLink();
                                }
                              }}
                            />
                            <button
                              onClick={importLink}
                              disabled={busy || !url}
                            >
                              Import
                            </button>
                          </div>
                        ) : (
                          <button
                            className="upload-target"
                            onClick={() => uploadRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              uploadFiles(e.dataTransfer.files);
                            }}
                          >
                            {selected?.image_path &&
                            studio.images[selected.image_path] ? (
                              <>
                                <img
                                  src={studio.images[selected.image_path]}
                                  alt="Selected thumbnail"
                                />
                                <span>Change image</span>
                              </>
                            ) : (
                              <>
                                <ImagePlus size={23} />
                                <span>
                                  {tool === "recreate"
                                    ? "Drop a thumbnail to recreate"
                                    : "Drop your thumbnail here"}
                                </span>
                                <small>PNG, JPG or WebP, up to 5 MB</small>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    {(tool === "analyze" || tool === "title") && (
                      <div className="field-block">
                        <label htmlFor="video-title">
                          <Type size={14} />
                          Video title
                        </label>
                        <input
                          id="video-title"
                          maxLength={100}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="The title your audience will see"
                        />
                      </div>
                    )}
                    {tool === "analyze" && (
                      <div className="diagnostic-context">
                        <label htmlFor="video-brief">
                          What actually happens in the video?
                        </label>
                        <textarea
                          id="video-brief"
                          value={videoBrief}
                          onChange={(e) => setVideoBrief(e.target.value)}
                          maxLength={2400}
                          placeholder="Describe what viewers will see or learn, and any facts the thumbnail must keep. Optional for a visual-only score."
                        />
                        <label className="vision-choice">
                          <input
                            type="checkbox"
                            checked={includeVision}
                            onChange={(e) => setIncludeVision(e.target.checked)}
                          />
                          Add a detailed image review (one extra OpenAI or
                          Google request)
                        </label>
                        <p>
                          Idea and Curiosity need both a title and a video
                          summary. Without them, those pillars and the overall
                          score stay blank.
                        </p>
                      </div>
                    )}
                    {tool !== "analyze" && (
                      <>
                        <div className={tool==="edit"&&editSource?.image_path ? "edit-direction edit-direction--with-preview" : "edit-direction"}>
                          {tool==="edit"&&editSource?.image_path&&<details className="edit-source-preview" open><summary>Selected image <span>Show / hide preview</span></summary><img src={studio.images[editSource.image_path]} alt={"Editing source: "+editSource.title}/><p>{editSource.title} · Original stays saved</p></details>}
                          <div className="edit-direction-input">
                        <div className="prompt-heading">
                          <label htmlFor="thumbnail-prompt">
                            {tool === "edit"
                              ? "Edits"
                              : tool === "recreate"
                                ? "Make it yours"
                                : tool === "title" && titleAction === "ideas"
                                  ? "Video idea"
                                  : "Prompt"}
                          </label>
                          <span>{prompt.length}/2400</span>
                        </div>
                        <textarea
                          id="thumbnail-prompt"
                          maxLength={2400}
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={
                            tool === "recreate"
                              ? "Describe what to add, remove or replace…"
                              : tool === "edit"
                                ? "Change the background, improve the lighting, make the text bolder…"
                                : tool === "title"
                                  ? "Describe your video, audience, or visual direction…"
                                  : "Describe your thumbnail. Be specific about the subject, scene, text and emotion…"
                          }
                        />
                          </div>
                        </div>
                        <div className="reference-strip">
                          {refs.map((path, i) => (
                            <div className="reference-thumb" key={path}>
                              {studio.images[path] ? (
                                <img
                                  src={studio.images[path]}
                                  alt={`Reference ${i + 1}`}
                                />
                              ) : (
                                <ImagePlus size={18} />
                              )}
                              <button
                                aria-label={`Remove reference ${i + 1}`}
                                onClick={() =>
                                  setRefs((r) => r.filter((x) => x !== path))
                                }
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                          {persona && <div className="selection-chip-group"><button className="selection-chip" onClick={()=>openProfiles("personas")} aria-label={"Change persona: "+persona.name}>{studio.images[persona.refs[0]]&&<img src={studio.images[persona.refs[0]]} alt=""/>}<span className="selection-name">{persona.name}</span></button><button className="selection-remove" aria-label={"Remove persona: "+persona.name} onClick={()=>{setPersonaId("");document.querySelector<HTMLButtonElement>('.composer-tool-group button')?.focus();}}><X size={14}/></button></div>}
                          {styleProfile && <div className="selection-chip-group"><button className="selection-chip" onClick={()=>openProfiles("styles")} aria-label={"Change style: "+styleProfile.name}><Palette size={13}/><span className="selection-name">{styleProfile.name}</span></button><button className="selection-remove" aria-label={"Remove style: "+styleProfile.name} onClick={()=>{setStyleId("");document.querySelectorAll<HTMLButtonElement>('.composer-tool-group button')[1]?.focus();}}><X size={14}/></button></div>}
                        </div>
                        <div className="prompt-tools">
                          <div className="composer-tool-group" role="group" aria-label="Subject and style">
                          <button
                            className="tool-chip"
                            onClick={() => openProfiles("personas")}
                          >
                            <UserRoundPlus size={15} />
                            Persona
                          </button>
                          <button
                            className="tool-chip"
                            onClick={() => openProfiles("styles")}
                          >
                            <Palette size={15} />
                            Style
                          </button>
                          </div>
                          <div className="composer-tool-group" role="group" aria-label="Image references">
                          <button
                            className="tool-chip"
                            onClick={() => uploadRef.current?.click()}
                          >
                            <ImagePlus size={15} />
                            Add references
                            {refs.length > 0 && <span>{refs.length}/6</span>}
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Import references from link"
                            onClick={() => setLinkOpen((x) => !x)}
                          >
                            <Link2 size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Choose references from library"
                            onClick={() => setDialog("references")}
                          >
                            <Images size={15} />
                          </button>
                          </div>
                        </div>
                        {linkOpen && !["recreate", "edit"].includes(tool) && (
                          <div className="link-input">
                            <input
                              aria-label="Reference URL"
                              placeholder="Paste an image or YouTube URL"
                              value={url}
                              onChange={(e) => setUrl(e.target.value)}
                            />
                            <button
                              onClick={importLink}
                              disabled={busy || !url}
                            >
                              Import
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {tool === "analyze" ? (
                      <p className="analysis-helper">
                        Image + title. Five pillars. A clear next step.
                      </p>
                    ) : (
                      <>
                        {settings.model.startsWith("gemini-") && (
                          <p className="dialog-footnote">
                            Google uses its native 1K image output. Quality and
                            intelligence controls apply to Sunburst and Flare.
                          </p>
                        )}
                        <div className="settings-row">
                          <ModelTrigger label="Rendering model" model={settings.model} expanded={dialog==="models"} onOpen={()=>setDialog("models")}/>
                          <label>
                            {settings.format === "long" ? (
                              <RectangleHorizontal size={14} />
                            ) : (
                              <RectangleVertical size={14} />
                            )}
                            <select
                              aria-label="Format"
                              value={settings.format}
                              onChange={(e) =>
                                changeSettings(
                                  "format",
                                  e.target.value as Settings["format"],
                                )
                              }
                            >
                              <option value="long">Long-form 16:9</option>
                              <option value="short">Short-form 9:16</option>
                            </select>
                          </label>
                          <button
                            className={
                              advanced
                                ? "advanced-button active"
                                : "advanced-button"
                            }
                            onClick={() => setAdvanced((x) => !x)}
                            aria-expanded={advanced}
                          >
                            <SlidersHorizontal size={14} />
                            Controls
                          </button>
                        </div>
                        {advanced && (
                          <div className="advanced-controls">
                            <label>
                              Quality
                              <select
                                aria-label="Quality"
                                disabled={settings.model.startsWith("gemini-")}
                                value={settings.quality}
                                onChange={(e) =>
                                  changeSettings(
                                    "quality",
                                    e.target.value as Settings["quality"],
                                  )
                                }
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="xhigh">XL</option>
                                <option value="max">Max</option>
                              </select>
                            </label>
                            <label>
                              Intelligence
                              <select
                                aria-label="Intelligence"
                                disabled={settings.model.startsWith("gemini-")}
                                value={settings.complexity}
                                onChange={(e) =>
                                  changeSettings(
                                    "complexity",
                                    e.target.value as Settings["complexity"],
                                  )
                                }
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </label>
                            <label>
                              Visual direction
                              <select
                                aria-label="Visual direction"
                                value={preset}
                                onChange={(e) => {
                                  setPreset(e.target.value);
                                  setStyleId("");
                                }}
                              >
                                {[
                                  "Auto",
                                  "Cinematic",
                                  "Bold & bright",
                                  "Clean editorial",
                                  "Documentary",
                                  "Minimal",
                                ].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </label>
                            <p>
                              Quality controls detail. Intelligence controls
                              planning. Higher settings can take longer and use
                              more API credit.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </fieldset>
                  <div className="request-readiness" id="request-readiness" role="group" aria-label="Before you generate">
                    <p className="request-identity">{readiness.identity}</p><p>{readiness.quantity}</p>
                    <p className="request-ready" role="status">{readiness.readiness}</p>
                    <p className="request-cost">{readiness.cost}</p>
                  </div>
                  <div className="generate-dock">
                    <div className="generate-split">
                      <button
                        className="primary-button"
                        disabled={busy||readiness.action==="unavailable"}
                        aria-describedby="request-readiness"
                        onClick={()=>readiness.action==="signin"?setDialog("login"):readiness.action==="connect"?setDialog("connections"):submit()}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : tool === "analyze" ? (
                          <ScanLine size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        <span>
                          {busy
                            ? studio.busy
                            : readiness.action==="signin" ? (tool==="analyze"?"Sign in to analyze":"Sign in to generate") : readiness.action==="connect" ? "Connect "+readiness.provider : readiness.action==="unavailable" ? "AI unavailable" : tool === "analyze"
                              ? "Analyze thumbnail"
                              : tool === "title" && titleAction === "ideas"
                                ? "Generate titles"
                                : "Generate"}
                        </span>
                      </button>
                      {tool !== "analyze" &&
                        !(tool === "title" && titleAction === "ideas") && (
                          <label className="batch-select">
                            <span className="sr-only">Batch size</span>
                            <select
                              aria-label="Batch size"
                              value={settings.batch}
                              disabled={busy}
                              onChange={(e) =>
                                changeSettings(
                                  "batch",
                                  Number(e.target.value) as Settings["batch"],
                                )
                              }
                            >
                              <option value={1}>1×</option>
                              <option value={2}>2×</option>
                              <option value={4}>4×</option>
                            </select>
                          </label>
                        )}
                    </div>
                  </div>
                </div>
                <div className="composer-footer" hidden={!showComposer}>
                  <span>
                    {tool === "analyze"
                      ? "Scores use your API credits. Resize does not."
                      : studio.live
                        ? "Generation uses your connected API credits."
                        : "Your draft saves on this device. Sign in and connect an API key to generate."}
                  </span>
                  {tool !== "analyze" && (
                    <div className="save-draft-feedback">
                      <button
                        className="save-draft-button"
                        aria-label={saveReceipt ? "Draft saved. Save draft again" : "Save draft"}
                        data-confirmed={saveReceipt > 0}
                        onClick={saveDraft}
                        disabled={busy}
                      >
                        {saveReceipt ? <PixelConfirmation key={saveReceipt} /> : <FolderOpen size={12} />}
                        <span>{saveReceipt ? "Draft saved" : "Save draft"}</span>
                      </button>
                      <span className="sr-only" role="status">{saveReceipt ? "Draft saved to your library." : ""}</span>
                    </div>
                  )}
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Upload thumbnail references"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </section>
              {titles.length > 0 && (
                <section className="title-results result-section">
                  <div className="section-heading">
                    <h2>Five ways into your story.</h2>
                    <span>Title ideas</span>
                  </div>
                  {titles.map((t, i) => (
                    <div className="title-option" key={t}>
                      <span className="title-number">{i + 1}</span>
                      <p>{t}</p>
                      <button
                        className="icon-button"
                        aria-label={`Copy title ${i + 1}`}
                        onClick={() =>
                          studio.run("Copying title", async () =>
                            navigator.clipboard.writeText(t),
                          )
                        }
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="quiet-button"
                        onClick={() => {
                          setTitle(t);
                          setTitleAction("image");
                        }}
                      >
                        Use title
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {!hasReviewImage && resultPanel}
              {!selected && tool === "analyze" && (
                <section className="pillars-intro" aria-label="Scoring pillars">
                  {pillars.map((p) => (
                    <div key={p}>
                      <h2>{names[p]}</h2>
                      <p>{definitions[p]}</p>
                    </div>
                  ))}
                  <p>
                    AI packaging assessment. Validate real performance with
                    YouTube Test & Compare.
                  </p>
                </section>
              )}
              {studio.creations.length > 0 && !selected && (
                <section className="result-section recent-creations">
                  <div className="section-heading">
                    <h2>Recent creations</h2>
                    <button
                      className="quiet-button"
                      onClick={() => { setTab("library"); if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); } }}
                    >
                      View library
                    </button>
                  </div>
                  <div className="creation-grid">
                    {studio.creations.slice(0, 3).map(card)}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="library-view">
              <div className="section-heading">
                <div>
                  <h1>Your creations</h1>
                  <p>Every idea. Every iteration. All yours.</p>
                </div>
                <button className="neutral-button" onClick={newChat}>
                  <Plus size={16} />
                  New creation
                </button>
              </div>
              <div className="library-filters">
                <label>
                  <Search size={16} />
                  <input
                    aria-label="Search creations"
                    placeholder="Find a thumbnail or idea"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  className={
                    onlyFavorites ? "neutral-button active" : "neutral-button"
                  }
                  aria-pressed={onlyFavorites}
                  onClick={() => setOnlyFavorites((x) => !x)}
                >
                  <Star size={15} />
                  Favorites
                </button>
              </div>
              <div className="creation-grid">{filtered.map(card)}</div>
              {!filtered.length && (
                <div className="library-empty">
                  <FolderOpen size={30} />
                  <h2>
                    {studio.creations.length
                      ? "No matching creations."
                      : "Start with your next idea."}
                  </h2>
                  <p>
                    {studio.creations.length
                      ? "Try another search or clear your filters."
                      : "Upload an image, write a prompt, or save a concept."}
                  </p>
                  <button className="neutral-button" onClick={newChat}>
                    Create a thumbnail
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>OpenPikzels</span>
          <span>Made for your next upload.</span>

        </footer>
      </div>
      <dialog
        aria-labelledby="studio-dialog-title"
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClose={() => { if (!dialogRef.current?.open) { setDialog(null); restoreDialogFocus(); } }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
      >
        <div className="dialog-shell">
          <div className="dialog-heading">
            <h2 id="studio-dialog-title">
              {dialog==="models"?"Image models":dialog==="inspect"?"Inspect your thumbnail":dialog==="analysis"?"Thumbnail Analysis":dialog==="beforeafter"?"Compare Your Thumbnail":dialog==="feedback"?"Leave Your Feedback":dialog === "personas"
                ? profileDialogTitle || "Your personas"
                : dialog === "styles"
                  ? profileDialogTitle || "Your styles"
                  : dialog === "references"
                    ? "Reference library"
                    : dialog === "login"
                      ? "Your private workspace"
                      : dialog === "fixplan"
                        ? "Review one-click fix"
                        : dialog === "compare"
                          ? "Compare without scores"
                          : dialog === "jobs"
                            ? "API activity"
                            : "Workspace connections"}
            </h2>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <X size={18} />
            </button>
          </div>
          {dialog==="models"&&<ModelPicker model={settings.model} onChoose={value=>{changeSettings("model",value);setDialog(null);}}/>}
          {(dialog==="personas"||dialog==="styles")&&<ProfileManager key={dialog+studio.user} kind={dialog==="personas"?"persona":"style"} studio={studio} onTitle={setProfileDialogTitle} selectedId={dialog==="personas"?personaId:styleId} onChoose={id=>{void selectProfile(dialog==="personas"?"persona":"style",id).catch(e=>studio.setError(e.message));}} onPreset={name=>{setPreset(name);setStyleId("");}} onClose={()=>setDialog(null)}/>}
          {dialog==="inspect"&&selected?.image_path&&<ImageInspector key={selected.id+studio.user} src={studio.images[selected.image_path]} title={selected.title}/>}
          {dialog==="analysis"&&score&&<AnalysisPanel score={score} busy={busy} onFix={fix}/>}
          {dialog==="beforeafter"&&selected&&(()=>{const original=studio.creations.find(c=>c.id===selected.parent_id);return original?.image_path&&selected.image_path?<><ComparisonSlider before={{src:studio.images[original.image_path],title:original.title}} after={{src:studio.images[selected.image_path],title:selected.title}}/>{studio.cloud&&<button className="neutral-button full-width" disabled={busy} onClick={compare}>Compare without scores</button>}</>:<p>Choose a revised thumbnail with a saved original to compare.</p>;})()}
          {dialog==="feedback"&&selected?.image_path&&<FeedbackForm key={selected.id+studio.user} image={studio.images[selected.image_path]} title={selected.title} onSave={body=>studio.feedback(selected.id,body)}/>}
          {dialog === "references" && (
            <>
              <p className="dialog-description">
                Bring a saved creation into your next thumbnail.
              </p>
              <div className="reference-library">
                {studio.creations
                  .filter((c) => c.image_path)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (refs.length >= 6) {
                          studio.setError("Use up to six references.");
                          return;
                        }
                        if (!refs.includes(item.image_path!))
                          setRefs((r) => [...r, item.image_path!]);
                        if (["analyze", "edit"].includes(tool))
                          setSelection(item.id);
                        setDialog(null);
                      }}
                    >
                      <img
                        src={studio.images[item.image_path!]}
                        alt={item.title}
                      />
                      <span>{item.title}</span>
                    </button>
                  ))}
              </div>
              {!studio.creations.some((c) => c.image_path) && (
                <p className="dialog-description">
                  Upload or generate an image to start your reference library.
                </p>
              )}
              <button
                className="neutral-button full-width"
                onClick={() => {
                  setDialog(null);
                  uploadRef.current?.click();
                }}
              >
                <Upload size={15} />
                Upload a new reference
              </button>
            </>
          )}
          {dialog === "jobs" && (
            <>
              <p>
                Requests remain here after a reload. If the outcome is still
                being checked, API credits may already have been used. Wait and
                check My creations before trying again.
              </p>
              <button className="neutral-button full-width" disabled={busy} onClick={showJobs}>Refresh activity</button>
              {!jobs.length&&<p>No API requests in this workspace yet.</p>}
              {jobs.map((j) => (
                <div className="connection-row" key={j.id}>
                  <strong>{j.operation === "generate" ? "Image generation" : j.operation === "analyze" ? "Thumbnail analysis" : "API request"}</strong>
                  <span>
                    {jobGuidance(j.state).label}
                    {` · Up to ${j.max_provider_calls} API request${j.max_provider_calls === 1 ? "" : "s"}`}
                    <small>{jobGuidance(j.state).message}</small>
                    {j.created_at&&<small>{new Date(j.created_at).toLocaleString()}</small>}
                    <small className="job-id">Request {j.id}</small>
                    {(()=>{const id=j.result?.creation?.id||j.result?.creations?.[0]?.id,item=studio.creations.find(c=>c.id===id);return item?<button className="neutral-button" disabled={busy} onClick={async()=>{setDialog(null);await choose(item);}}>Open saved result</button>:null;})()}
                  </span>
                </div>
              ))}
            </>
          )}
          {dialog === "compare" && blindPair && (
            <>
              <p className="dialog-description">{blindPair.notice}</p>
              <p>{blindPair.title}</p>
              <div className="blind-options">
                {blindPair.options.map((o) => (
                  <figure key={o.label}>
                    <figcaption>Option {o.label}</figcaption>
                    <img
                      src={o.preview}
                      width={200}
                      alt={`Option ${o.label} at actual 200 pixel width`}
                    />
                    <a href={o.fullImage} target="_blank" rel="noreferrer">
                      Inspect full image
                    </a>
                    <button
                      className="neutral-button"
                      disabled={busy || !!reviewResult}
                      onClick={() => decideComparison(o.label)}
                    >
                      Prefer {o.label}
                    </button>
                  </figure>
                ))}
              </div>
              <div className="consent-actions">
                {["tie", "inconclusive"].map((p) => (
                  <button
                    key={p}
                    className="neutral-button"
                    disabled={busy || !!reviewResult}
                    onClick={() => decideComparison(p)}
                  >
                    {p === "tie"
                      ? "No meaningful difference"
                      : "Needs more review"}
                  </button>
                ))}
              </div>
              <p role="status">{reviewResult}</p>
            </>
          )}
          {dialog === "fixplan" && (
            <>
              <p className="dialog-description">
                Preview the changes first, then choose whether to spend API
                credits on one new image. Your original stays saved. The new
                image will not be scored automatically.
              </p>
              {[
                ["Exact wording to preserve", exactText, setExactText],
                ["Required objects", requiredObjects, setRequiredObjects],
                ["Forbidden changes", forbiddenChanges, setForbiddenChanges],
              ].map(([label, value, setter]) => (
                <label key={String(label)}>
                  {String(label)}
                  <textarea
                    value={String(value)}
                    maxLength={1200}
                    placeholder="One item per line, up to eight"
                    onChange={(e) => {
                      (setter as (s: string) => void)(e.target.value);
                      setFixReview(null);
                    }}
                  />
                </label>
              ))}
              <p>
                The instructions keep the person, wording and video facts.
                The AI edits the whole image, so other details may also change.
                Review the result before downloading.
              </p>
              <button
                className="neutral-button full-width"
                disabled={busy}
                onClick={prepareFix}
              >
                Preview fixes · no API charge
              </button>
              {fixReview?.plan && (
                <>
                  <p>
                    <strong>Title:</strong> {fixReview.plan.title}
                  </p>
                  <p>
                    <strong>Video promise:</strong> {fixReview.plan.videoBrief}
                  </p>
                  <dl className="fix-settings">
                    <div><dt>Model</dt><dd>{fixReview.plan.settings.model}</dd></div>
                    <div><dt>Quality</dt><dd>{fixReview.plan.settings.quality}</dd></div>
                    <div><dt>Images</dt><dd>1</dd></div>
                  </dl>
                  <ol>
                    {fixReview.plan.operations.map((o) => (
                      <li key={o.id}>
                        <strong>{names[o.pillar]}</strong>
                        <p>{o.instruction}</p>
                        <small>{o.tradeoff}</small>
                      </li>
                    ))}
                  </ol>
                  <p>{fixReview.notice}</p>
                  <button
                    className="primary-button full-width"
                    disabled={busy}
                    onClick={applyFix}
                  >
                    Generate fix with API credits
                  </button>
                </>
              )}
              {fixReview?.reason && <p role="status">{fixReview.reason}</p>}
            </>
          )}
          {dialog === "connections" && (
            <>
              <p className="dialog-description">
                Your workspace uses your own OpenAI, Google and Jev keys.
                Connect providers, manage agent access and copy MCP instructions
                in Settings.
              </p>
              <a href="/connect" className="primary-button inline-link">
                Manage connections
              </a>
              {studio.cloud&&<button className="neutral-button full-width" disabled={busy} onClick={showJobs}>View API activity</button>}
              <p className="dialog-footnote">
                Your keys are encrypted and private to your account. Agent tools
                never receive them.
              </p>
            </>
          )}
          {dialog === "login" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                studio.run("Signing in", async () => {
                  await studio.login(email, password);
                  setPassword("");
                  setDialog(null);
                });
              }}
            >
              <p className="dialog-description">
                Sign in to your private workspace.
              </p>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary-button full-width" disabled={busy}>
                Sign in
              </button>
            </form>
          )}
          {dialog === "login" && (
            <p className="dialog-footnote">
              New here?{" "}
              <a href="/connect">Create an account and connect your keys</a>
            </p>
          )}
          {studio.error && (
            <p className="dialog-error" role="status">
              {studio.error}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
  function card(item: Creation) {
    return (
      <article className="creation-card" key={item.id}>
        <button
          className="creation-card-image"
          disabled={busy}
          onClick={() =>
            item.status === "draft" ? resume(item) : choose(item)
          }
        >
          {item.image_path && studio.images[item.image_path] ? (
            <img src={studio.images[item.image_path]} alt={item.title} />
          ) : (
            <div className="concept-thumbnail">
              <ImagePlus size={22} />
              <p>{item.prompt}</p>
            </div>
          )}
          <span>
            {item.status === "ready"
              ? item.settings?.format === "short"
                ? "9:16"
                : "16:9"
              : item.status}
          </span>
        </button>
        <div className="creation-card-info">
          <button disabled={busy} onClick={() => choose(item)}>
            <strong>{item.title}</strong>
            <small>
              {new Date(item.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </small>
          </button>
          <button
            className={item.favorite ? "icon-button favorited" : "icon-button"}
            aria-label={`Favorite ${item.title}`}
            aria-pressed={item.favorite}
            onClick={() =>
              studio.run("Saving favorite", () => studio.favorite(item))
            }
          >
            <Star size={14} fill={item.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label={`Delete ${item.title}`}
            disabled={busy}
            onClick={() => deleteCreation(item)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>
    );
  }
}