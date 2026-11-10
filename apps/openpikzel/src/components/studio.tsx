"use client";
import {NativeOutputNotice} from "@/components/creative/native-output";
import {GenerationDelivery} from "@/components/creative/generation-delivery";
import {deliverImages,type DeliveryState,type ReviewStatus} from "@/lib/generation-delivery";
import {PromptEnhancer,CreativeConversation,type CreativeDraft} from "@/components/creative/creative-partner";
import {ProviderChoice} from "@/components/creative/provider-choice";
import { generationReadiness } from "@/lib/generation-readiness";
import { pickVisionProvider } from "@/lib/vision-provider";
import { critiqueProviderFromScore, reviewerName, scorePlan, scoreStatusCopy, scoreStatusFromEvaluation } from "@/lib/score-on-generate";
import { GEMINI_FIX_NOTICE } from "@/lib/fix-plan-notice";
import { promptValidationError } from "@/lib/prompt-validation";
import {useRequestActivity} from "@/lib/use-request-activity";
import { jobGuidance } from "@/lib/job-state";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import {AccountSignIn} from "@/components/account/sign-in";
import {publicStyles} from "@/lib/workspaces";
import { PixelConfirmation } from "@/components/pixel-confirmation";
import { imageModel } from "@/lib/image-models";
import { AnalysisScanner } from "@/components/creative/analysis-scanner";
import { ScoreAnnouncer, ScoreNumber, useScoreArrival, useScoreReveal } from "@/components/creative/score-count";
import { revealKey } from "@/lib/score-count";
import { recomposePrompt, type ScanPhase } from "@/lib/analysis-display";
import { ReviewCanvas } from "@/components/review-canvas";
import {ModelTrigger,ModelPicker} from "@/components/creative/model-picker";
const AnalysisHistory=dynamic(()=>import("@/components/creative/analysis-history").then(m=>m.AnalysisHistory),{loading:()=> <p role="status">Reading history…</p>});
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
  | "analysis-history"
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
  const activity=useRequestActivity({user:studio.user,cloud:studio.cloud,read:studio.read,onSucceeded:studio.load});
  const jobs=activity.jobs;
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
    [promptError, setPromptError] = useState(""),
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
  const [videoUrl, setVideoUrl] = useState("");
  const [creativeDraft,setCreativeDraft]=useState<CreativeDraft>({}),[delivery,setDelivery]=useState<DeliveryState|null>(null),[reviewStatuses,setReviewStatuses]=useState<Record<string,ReviewStatus>>({});
  const deliveryAttempt=useRef(0),selectedIdRef=useRef<string|null>(null),scoreIntent=useRef<Record<string,{title:string;includeVision:boolean;videoUrl:string;critiqueProvider:ReturnType<typeof scorePlan>["critiqueProvider"]}>>({}),oneClickInFlight=useRef<Promise<unknown>|null>(null);selectedIdRef.current=selection;
  const [directionUndo,setDirectionUndo]=useState<{before:{prompt:string;title:string;tool:Tool};after:string}|null>(null);
  const [analysisScan, setAnalysisScan] = useState<{id:number;src:string;phase:ScanPhase;reviewer:string}|null>(null);
  const scanAttempt = useRef(0);
  const [textProvider,setTextProvider]=useState<"openai"|"google">("openai");
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
    [reviewResult, setReviewResult] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null),
    uploadRef = useRef<HTMLInputElement>(null),
    mainRef = useRef<HTMLElement>(null),
    promptRef = useRef<HTMLTextAreaElement>(null),
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
  // OP-11: a score counts up once, and only when it arrives this session: while its creation is
  // selected, or with a creation that appeared after the library loaded (a new generation). A score
  // already there at load or selection is static. An explicit analysis reveals in its dialog first,
  // so the panel waits while that analysis is finishing and while the dialog covers it.
  const scoreKey = revealKey(selected?.id, score),
    scoreArrived = useScoreArrival(studio.user, studio.loading, studio.creations.map((c) => c.id), selected?.id ?? null, scoreKey);
  const scoreReveal = useScoreReveal(scoreKey, score?.overall ?? null, {
    paused: dialog === "analysis" || analysisScan?.phase === "running",
    arrived: scoreArrived,
  });
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
    if(!hydratedWorkspace)return;
    const url = new URL(location.href);
    url.searchParams.set("mode", tool);
    history.replaceState(null, "", url);
  }, [tool,hydratedWorkspace]);
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
  useEffect(() => {if(advanced)requestAnimationFrame(()=>document.querySelector<HTMLElement>(".generate-dock")?.scrollIntoView({block:"end",behavior:"instant"}));},[advanced]);
  useEffect(() => { setSaveReceipt(0); }, [draftFingerprint]);
  useEffect(() => {
    if (!saveReceipt) return;
    const timer = setTimeout(() => setSaveReceipt(0), 2800);
    return () => clearTimeout(timer);
  }, [saveReceipt]);
  const busy = !!studio.busy;
  const analysisVision = includeVision;
  const selectedVision=pickVisionProvider(studio.config||{});
  const analysisReviewer = includeVision && selectedVision ? reviewerName(selectedVision) : null;
  useEffect(() => { scanAttempt.current++; setAnalysisScan(null); }, [studio.user, selection]);
  const navigating=["Opening chat","Starting a new chat","Opening creation"].includes(studio.busy||"");
  const activeChat=studio.conversations.find(c=>c.id===activeChatId)||null;
  function activateChat(chat:Conversation,focus=true){
    workspaceEpoch.current++;
    const d=chat.draft;chatIdRef.current=chat.id;setActiveChatId(chat.id);localStorage.setItem("openpikzels.activeChat."+(studio.user||"local"),chat.id);
    setPrompt(d.prompt||"");setTitle(d.title||"");setTool(modes.some(m=>m.id===d.tool)?d.tool as Tool:"generate");
    setSettings({...defaultSettings,...d.settings,batch:1});setRefs(d.refs||[]);setPersonaId(d.personaId||"");setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setVideoUrl(d.videoUrl||"");setCreativeDraft(d.creativeDraft||{});setDirectionUndo(null);setDelivery(null);setTitleAction(d.titleAction||"image");setIncludeVision(!!d.includeVision);setTextProvider(d.textProvider||"openai");
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
    const meaningful=!!(draft.creativeDraft?.draft?.trim()||draft.creativeDraft?.messages?.length||draft.prompt?.trim()||draft.title?.trim()||(draft.videoBrief?.trim()||draft.videoUrl?.trim())||draft.refs?.length||draft.personaId||draft.styleId||draft.selection);
    if(!activeChat&&!meaningful)return;
    const chat=activeChat||await ensureChat();
    if(ownerUI.current===owner)await studio.saveConversation({...chat,draft,updated_at:new Date().toISOString()},"draft");
  }
  async function openChat(chat:Conversation){if(busy||chat.id===chatIdRef.current)return;await studio.run("Opening chat",async()=>{const owner=studio.user;await flushDraft();if(ownerUI.current===owner)activateChat(chat);});}
  async function newChat(){if(busy)return;await studio.run("Starting a new chat",async()=>{await flushDraft();const chat=await studio.createConversation();activateChat(chat);startNew();});}
  useEffect(()=>{workspaceEpoch.current++;setActiveChatId(null);chatCreation.current=null;setHydratedWorkspace("");hydratedOwner.current="";setPrompt("");setTitle("");setVideoBrief("");setVideoUrl("");setCreativeDraft({});setReviewStatuses({});setIncludeVision(false);setTextProvider("openai");setDirectionUndo(null);setDelivery(null);setTitles([]);setBlindPair(null);setReviewResult("");setFixReview(null);setDialog(null);setChatSaveState("");},[studio.user]);
  useEffect(()=>{
    if(studio.loading)return;const key=studio.user||"local";if(hydratedOwner.current===key)return;hydratedOwner.current=key;
    const saved=localStorage.getItem("openpikzels.activeChat."+key),chat=studio.conversations.find(c=>c.id===saved),checkpoint=readDraftCheckpoint(localStorage,key);
    if(chat)activateChat(checkpoint?.chatId===chat.id&&checkpoint.savedAt>=(chat.draft.draftSavedAt||0)?{...chat,draft:checkpoint.draft}:chat,false);
    else if(checkpoint&&!checkpoint.chatId){
      const d=checkpoint.draft;setPrompt(d.prompt||"");setTitle(d.title||"");setTool((d.tool||"generate") as Tool);setSettings({...defaultSettings,...d.settings});
      setRefs(d.refs||[]);setPersonaId(d.personaId||"");setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setVideoUrl(d.videoUrl||"");setCreativeDraft(d.creativeDraft||{});setDirectionUndo(null);setDelivery(null);setParentId(d.parentId||null);setTitleAction(d.titleAction||"image");setIncludeVision(!!d.includeVision);setTextProvider(d.textProvider||"openai");
    }
    const requested=new URL(location.href).searchParams.get("mode");
    if(modes.some(m=>m.id===requested))setTool(requested as Tool);
    setHydratedWorkspace(key);
  },[studio.loading,studio.user,studio.conversations]);
  const chatDraft:WorkspaceDraft={prompt,title,tool,settings,refs,personaId,styleId,preset,videoBrief,videoUrl,selection,parentId,titleAction,includeVision,textProvider,creativeDraft};
  const chatDraftRef=useRef(chatDraft);chatDraftRef.current=chatDraft;
  const chatDraftJSON=JSON.stringify(chatDraft);
  useEffect(()=>{
    const owner=studio.user,key=owner||"local";
    if(studio.loading||hydratedWorkspace!==key)return;
    const draft={...JSON.parse(chatDraftJSON),draftSavedAt:Date.now()} as WorkspaceDraft;
    const meaningful=!!(draft.prompt?.trim()||draft.title?.trim()||(draft.videoBrief?.trim()||draft.videoUrl?.trim())||draft.refs?.length||draft.personaId||draft.styleId||draft.selection||draft.preset!=="Auto"||JSON.stringify(draft.settings)!==JSON.stringify(defaultSettings));
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
       else{workspaceEpoch.current++;chatIdRef.current=null;setActiveChatId(null);setPrompt("");setRefs([]);setPersonaId("");setStyleId("");setVideoBrief("");setVideoUrl("");setCreativeDraft({});setDirectionUndo(null);setDelivery(null);setPreset("Auto");localStorage.removeItem("openpikzels.activeChat."+(owner||"local"));}
      }
      setParentId(item.image_path?item.id:item.parent_id);
      setComposerOpen(false);setSaveReceipt(0);setSelection(item.id);
      setTitle(current => item.conversation_id && item.conversation_id === activeChatId ? current : (studio.conversations.find(c => c.id === item.conversation_id)?.draft.title ?? item.score?.context?.title ?? ""));
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
    setPromptError("");
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

  async function callCreative(input:Record<string,unknown>){
    const owner=studio.user,epoch=workspaceEpoch.current,source=selection;
    if(!studio.cloud)throw new Error("Sign in and connect your own API key in Connections.");
    const chat=await ensureChat();
    if(ownerUI.current!==owner||workspaceEpoch.current!==epoch||selectedIdRef.current!==source)throw new Error("Your project or selected image changed. Send the request again from the current context.");
    const result=await studio.api("/api/creative",{title,mode:tool,format:settings.format,direction:prompt,personaId:personaId||undefined,styleId:styleId||undefined,referencePaths:refs,videoUrl,...input,conversationId:chat.id,...(source?{creationId:source}:{})});
    if(ownerUI.current!==owner||workspaceEpoch.current!==epoch||selectedIdRef.current!==source)throw new Error("Your context changed. The result remains in API activity.");
    return result;
  }
  function applyDirection(after:string,nextTitle=title,nextTool:Tool=tool){
    setDirectionUndo({before:{prompt,title,tool},after});setPrompt(after);setTitle(nextTitle);setTool(nextTool);setComposerOpen(true);
  }
  async function createReviewed(input:any,onImages:(result:{creations:Creation[];partial:boolean})=>void|Promise<void>){
    const plan=scorePlan(studio.config),owner=studio.user,epoch=workspaceEpoch.current,id=++deliveryAttempt.current;
    setReviewStatuses({});
    return deliverImages({
      generate:()=>studio.generate(input),current:()=>ownerUI.current===owner&&workspaceEpoch.current===epoch,
      onImages,onStage:(stage,reviewed,total)=>setDelivery({id,stage,reviewed,total,message:""}),
      ...(plan.review?{review:(item:Creation)=>{const intent={title:input.title||"",includeVision:plan.includeVision,videoUrl,critiqueProvider:plan.critiqueProvider};scoreIntent.current[item.id]=intent;return studio.analyze(item,intent.title,"",intent.includeVision,intent.videoUrl,intent.critiqueProvider||undefined);},onReview:(itemId,status)=>setReviewStatuses(current=>({...current,[itemId]:status})),holdMs:45_000}:{}),
    });
  }
  async function retryScore(){
    if(!selected)return;
    const plan=scorePlan(studio.config);
    const intent=scoreIntent.current[selected.id]||{title,includeVision:plan.includeVision,videoUrl,critiqueProvider:plan.critiqueProvider};
    await studio.run("Retrying score",async()=>{
      await studio.analyze(selected,intent.title,"",intent.includeVision,intent.videoUrl,intent.critiqueProvider||undefined);
    });
  }

  async function submit() {
    // Prompt-only validation is shown under the field (not the top banner) and focuses it.
    const invalid=promptValidationError({tool,titleAction,prompt,title});
    if(invalid){studio.setError("");setPromptError(invalid);requestAnimationFrame(()=>promptRef.current?.focus());return;}
    setPromptError("");
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
          const attempt=++scanAttempt.current;
          setAnalysisScan({id:attempt,src:studio.images[selected.image_path],phase:"running",reviewer:analysisReviewer ? "Requested: Jev scoring + "+analysisReviewer+" image review." : "Requested: Jev scoring. Separate image review is off."});
          try {
            await studio.analyze(selected, title, "", analysisVision, videoUrl, selectedVision||undefined);
            if (scanAttempt.current !== attempt) return;
            setAnalysisScan(current=>current?.id===attempt ? {...current,phase:"succeeded"} : current);
          } catch (error) {
            if (scanAttempt.current === attempt) setAnalysisScan(current=>current?.id===attempt ? {...current,phase:"failed"} : current);
            throw error;
          }
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
            provider: textProvider,
          });
          setTitles(result.titles);
          return;
        }
        if (tool === "title" && !title.trim() && !prompt.trim())
          throw new Error("Add a video title or direction before generating.");
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
        const result = await createReviewed(input,async result=>{
        if(draftFingerprintRef.current===submittedFingerprint){
          setSelection(result.creations[0].id);setComposerOpen(false);
          requestAnimationFrame(() => reviewHeadingRef.current?.focus());
        }else{
          setPendingResult(result.creations[0].id);
          await studio.saveConversation({...chat,draft:chatDraftRef.current,updated_at:new Date().toISOString()},"draft");
        }
        });
        if (result.partial)
          studio.setError(
            "Some images were saved, but the batch stopped. Check My creations before generating again to avoid duplicate charges.",
          );
      },
    );
  }
  async function saveDraft() {
    if(!prompt.trim()&&!title.trim()){studio.setError("Write a direction or title before saving.");return;}
    if((payload().prompt||title).trim().length<8){studio.setError("Add at least eight characters to describe your idea.");return;}
    const savingFingerprint = draftFingerprint;
    setSaveReceipt(0);
    await studio.run("Saving draft", async () => {
      const chat=await ensureChat();
      const input = payload();
      const item = await studio.saveDraft({
        conversationId:chat.id,
        prompt: input.prompt || title,
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
  async function runOneClickFix() {
    if (!selected) return;
    if (oneClickInFlight.current) return oneClickInFlight.current;
    const source = selected;
    const work = studio.run("Applying one-click fix", async () => {
      const plan = scorePlan(studio.config);
      const stored = scoreIntent.current[source.id];
      const critiqueProvider = stored?.critiqueProvider || critiqueProviderFromScore(source.score) || plan.critiqueProvider;
      const includeVision = stored ? stored.includeVision : !!critiqueProvider;
      const intentTitle = stored?.title ?? source.title ?? title;
      const intentVideo = stored?.videoUrl ?? videoUrl;
      const result = await studio.oneClickFix(source, {
        settings,
        conversationId: activeChatId,
        title: intentTitle,
        includeVision,
        videoUrl: intentVideo,
        critiqueProvider: critiqueProvider || undefined,
      }) as {kind?:string;reason?:string;creations?:Creation[]}|undefined;
      if (result?.kind === "blocked" || result?.kind === "noop") {
        setFixReview({kind: result.kind, reason: result.reason});
        return;
      }
      const child = result?.creations?.[0];
      if (child) {
        scoreIntent.current[child.id] = {title:intentTitle,includeVision,videoUrl:intentVideo,critiqueProvider:critiqueProvider||null};
        setSelection(child.id);
        setDialog(null);
        setComposerOpen(false);
      }
    });
    oneClickInFlight.current = work;
    try {
      return await work;
    } finally {
      oneClickInFlight.current = null;
    }
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
      const result = await createReviewed({
        prompt:
          "Apply the reviewed packaging edits while preserving the original.",
        title: plan.title,
        conversationId: activeChatId,
        parentId: plan.sourceId,
        mode: "fix",
        settings: plan.settings,
        fixPlanToken: fixReview.token,
        requestId: crypto.randomUUID(),
      },result=>{setSelection(result.creations[0].id);setDialog(null);});
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
    const owner=studio.user,epoch=workspaceEpoch.current;
    await activity.refresh();
    if(ownerUI.current!==owner||workspaceEpoch.current!==epoch)return;
    setDialog("jobs");
  }
  async function resize() {
    if (!selected?.image_path) return;
    if (!studio.cloud) { setDialog("login"); return; }
    const model=imageModel(settings.model);
    if (!studio.config?.[model.provider]) { setDialog("connections"); return; }
    const source=selected, format=source.settings?.format === "short" ? "long" : "short";
    const fingerprint=draftFingerprintRef.current;
    await studio.run("Recomposing thumbnail with AI", async () => {
      const result=await createReviewed({
        conversationId: source.conversation_id || activeChatId || undefined,
        prompt: recomposePrompt(format), title: source.title || title, mode:"edit",intent:"recompose", style:source.style,
        parentId:source.id, referencePath:source.image_path, referencePaths:[source.image_path!],
        settings:{...settings,format,batch:1},requestId:crypto.randomUUID(),
      },result=>{
      const copy=result.creations?.[0];
      if (copy && draftFingerprintRef.current===fingerprint) {
        setSelection(copy.id); setParentId(copy.id); setComposerOpen(false);
      }
      });
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
    // Keep the user's video title; selected.title may only be an asset label.
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
  const scoreView = score ? scoreStatusFromEvaluation(score) : !studio.config?.jev ? {kind:"no-jev" as const} : selected && reviewStatuses[selected.id]==="pending" ? {kind:"pending" as const} : selected && reviewStatuses[selected.id]==="failed" ? {kind:"failed" as const} : {kind:"idle" as const};
  const scoreCopy = scoreStatusCopy(scoreView);
  const showComposer = !hasReviewImage || composerOpen;
  const readiness = generationReadiness({config:studio.config,cloud:studio.cloud,loading:studio.loading,tool,titleIdeas:tool==="title"&&titleAction==="ideas",settings,prompt,title,hasSource:!!(tool==="edit"?editSource?.image_path:selected?.image_path),hasReferences:refs.length>0,includeVision:analysisVision,textProvider});
  // The inline prompt message follows the current text and mode, and clears once the prompt is valid.
  useEffect(()=>{if(!promptError)return;const next=promptValidationError({tool,titleAction,prompt,title})||"";if(next!==promptError)setPromptError(next);},[promptError,tool,titleAction,prompt,title]);
  // OP-3: the action, its cost and the key note sit directly under the prompt.
  const showCost=!busy&&!!readiness.costShort&&(readiness.action==="run"||readiness.action==="signin");
  const generateAction = (
                  <div className="generate-dock" data-placement={tool==="analyze"?"after-settings":"under-prompt"}>
                    <div className="generate-split">
                      <button
                        className="primary-button"
                        disabled={busy||readiness.action==="unavailable"||readiness.action==="loading"}
                        aria-describedby={(showCost?"generate-cost-description ":"")+"request-readiness"}
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
                            : readiness.action==="signin" ? (tool==="analyze"?"Sign in to analyze":"Sign in to generate") : readiness.action==="connect" ? "Connect "+readiness.provider : readiness.action==="loading" ? "Checking your workspace…" : readiness.action==="unavailable" ? "AI unavailable" : tool === "analyze"
                              ? "Analyze thumbnail"
                              : tool === "title" && titleAction === "ideas"
                                ? "Generate titles"
                                : tool === "edit" ? "Apply AI edit" : tool === "recreate" ? "Create variation" : "Create thumbnail"}
                        </span>
                        {showCost&&<span className="generate-cost" aria-hidden="true">{readiness.costShort}</span>}
                      </button>
                      {tool !== "analyze" &&
                        !(tool === "title" && titleAction === "ideas") && (
                          <label className="batch-select">
                            <span className="sr-only">Images per request</span>
                            <select
                              aria-label="Images per request"
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
                    {showCost&&<span id="generate-cost-description" className="sr-only">{readiness.costDescription}</span>}
                    <p className="generate-key-note" id="generate-key-note">{readiness.keyNote.connected?readiness.keyNote.text:<>{readiness.keyNote.text} <button type="button" className="generate-key-link" onClick={()=>setDialog("connections")}>{readiness.keyNote.link}</button></>}</p>
                  </div>
  );
  const providerControls=<><ProviderChoice value={textProvider} onChange={setTextProvider} config={studio.config} disabled={busy} connectedShownNearby={readiness.keyNote.connected&&readiness.keyNote.provider===(textProvider==="openai"?"OpenAI":"Google")}/><label className="permission-field"><input type="checkbox" checked={includeVision} disabled={busy} onChange={e=>setIncludeVision(e.target.checked)}/>Add image-specific review to analysis (one extra provider request)</label></>;
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
                    {selected.image_path&&studio.images[selected.image_path]&&<NativeOutputNotice src={studio.images[selected.image_path]} requested={selected.style==="Uploaded"?undefined:selected.settings?.format} native={!!selected.lineage?.nativeOutput&&selected.mode!=="resize"}/>}

                    </div>
                    <div className="result-utilities">
                    {studio.cloud&&selected.image_path&&<button className="neutral-button" disabled={busy} onClick={()=>setDialog("analysis-history")}>Analysis history</button>}
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
                      <ReviewCanvas key={studio.images[selected.image_path]} src={studio.images[selected.image_path]} title={title || selected.score?.title || selected.title} feed={phone} pointer={motionInput === "pointer"} portrait={selected.settings?.format === "short"} onRefresh={() => studio.run("Refreshing preview", studio.load)} />
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
                          AI resize to{" "}
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
                          Download image
                        </button>
                      </div>
                      <div className="image-secondary-actions"><button className="quiet-button" onClick={()=>setDialog("inspect")}>Inspect image</button><button className="quiet-button" disabled={busy||!selected.parent_id} onClick={()=>setDialog("beforeafter")}>Compare before &amp; after</button><button className="quiet-button" disabled={busy} onClick={()=>{setRefs([selected.image_path!]);setTool("recreate");setComposerOpen(true);}}>Recreate this thumbnail</button><button className="quiet-button" onClick={()=>setDialog("feedback")}>Leave feedback</button></div>
                      <details className="provenance-details"><summary>Prompt and generation details</summary><dl><dt>Exact request</dt><dd>{selected.prompt}</dd><dt>Model / quality / format</dt><dd>{selected.settings?.model||"Uploaded image"} · {selected.settings?.quality||"Original"} · {selected.settings?.format||"Source format"}</dd><dt>References</dt><dd>{selected.reference_paths?.length||0} image references · {selected.persona_id?"Persona selected":"No Persona"} · {selected.style_id?"Private Style selected":selected.style}</dd><dt>Saved</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></dl></details>
                      <p className="resize-note">
                        AI resize creates one newly arranged image using {imageModel(settings.model).name}. Provider usage charges apply; a reliable cost estimate is unavailable. The original stays saved. Choose the model and quality in Generation settings.
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
                            : selected.status === "ready"
                              ? "This image preview is unavailable. Refresh the preview to check again."
                              : selected.status === "reconciling"
                                ? "The request outcome is uncertain. Check My creations and provider history before starting another request."
                                : "This image is still processing. Check My creations before starting another request."}
                      </span>
                      {selected.status === "ready" && <button className="neutral-button" disabled={busy} onClick={() => studio.run("Refreshing preview", studio.load)}>Refresh preview</button>}
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
                    <aside className="score-panel review-inspector" aria-label="Scoring inspector" data-reveal={scoreReveal.running ? "running" : "settled"}>
                      <div className="score-header">
                        <div>
                          <span>OpenPikzels Score</span>
                          <h2>
                            {score.overall === null ? "Partial" : <ScoreNumber reveal={scoreReveal} final={score.overall} />}
                            {score.overall !== null && <small>/100</small>}
                          </h2>
                          <p>{scoreCopy.title}. Thumbnail + title, across five pillars.</p><button className="quiet-button" onClick={()=>setDialog("analysis")}>Open analysis details</button>
                        </div>
                        <div>
                        <button
                          className="primary-button fix-button"
                          disabled={busy || !!score.fixBlocked || fixReview?.kind === "blocked" || fixReview?.kind === "noop"}
                          onClick={() => void runOneClickFix()}
                        >
                          <WandSparkles size={16} />
                          Fix what's holding it back
                        </button>
                        <a href="#adjust-fix" onClick={e=>{e.preventDefault();void fix();}}>Adjust fix first</a>
                        {imageModel(settings.model).provider === "google" && <p>{GEMINI_FIX_NOTICE}</p>}
                        {(fixReview?.kind === "blocked" || fixReview?.kind === "noop") && fixReview.reason && (
                          <p role="status">{fixReview.reason}</p>
                        )}
                        </div>
                      </div>
                      <div className="score-body">
                        <div className="pillar-list">
                          {pillars.map((p, i) => (
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
                                <span className="pillar-meter" key={scoreReveal.run} style={{ "--i": i } as CSSProperties}>
                                  <progress
                                    aria-label={`${names[p]} score`}
                                    max={100}
                                    value={score.dimensions[p].score!}
                                  />
                                </span>
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
                      <h2>{scoreCopy.title}</h2>
                      {scoreView.kind==="idle"&&<>
                        <p>Review the thumbnail and its video title across five criteria. No written summary is needed.</p>
                        <ul>{pillars.map((pillar) => <li key={pillar}>{names[pillar]}</li>)}</ul>
                        <button className="neutral-button" onClick={() => openReviewEditor("analyze")}>Set up analysis</button>
                      </>}
                      {scoreView.kind==="no-jev"&&<button type="button" className="neutral-button" onClick={()=>setDialog("connections")}>Connections</button>}
                      {scoreView.kind==="failed"&&<button type="button" className="neutral-button" disabled={busy} onClick={()=>{void retryScore();}}>Retry score</button>}
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
            <button onClick={(event) => { event.currentTarget.focus({preventScroll:true}); openProfiles("personas"); }}>
              <Users size={16} />
              Personas
            </button>
            <button onClick={(event) => { event.currentTarget.focus({preventScroll:true}); openProfiles("styles"); }}>
              <Palette size={16} />
              Styles
            </button>
          </div>
          <p className="sidebar-workspace-status">{studio.cloud ? "Workspace signed in" : "Drafts saved on this device"}</p>
        </div>
      </aside>
      <div className="workspace-main" inert={compactNavigation && sidebar}>
        {/* OP-11: announces a newly revealed panel score once (the analysis dialog has its own region). */}
        <ScoreAnnouncer text={scoreReveal.announce} />
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
          {busy&&<OperationProgress label={delivery?.stage==="analyzing"?"Analyzing saved thumbnail":studio.busy}/>}
          {delivery&&<GenerationDelivery state={delivery} portrait={settings.format==="short"}/>}
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
          {studio.cloud&&<div className="activity-summary"><button className="neutral-button" onClick={()=>void showJobs()}>API activity</button><span role="status">{activity.active?activity.active+" active API request"+(activity.active===1?"":"s")+(activity.paused?" · status refresh paused":""):activity.loading?"Checking saved API activity…":activity.error?"Activity status unavailable; refresh to check.":"Saved API activity available"}</span></div>}
          {tab === "studio" ? (
            <>
              {hasReviewImage && resultPanel}
              {hydratedWorkspace===(studio.user||"local")&&!studio.loading&&<CreativeConversation key={(studio.user||"local")+":"+workspaceEpoch.current} contextKey={JSON.stringify({prompt,title,tool,format:settings.format,personaId,styleId,refs,videoUrl})} hasReferenceSelections={refs.length>0||!!personaId||!!styleId} selectionSummary={(personaId?"Selected persona brief. ":"")+(styleId?"Selected style brief. ":"")+refs.length+" direct references selected. "+(videoUrl?"Video link only; its content has not been watched.":"")} value={creativeDraft} onChange={setCreativeDraft} config={studio.config} call={callCreative} sourceId={selected?.image_path?selection:null} sourceTitle={selected?.title||""} disabled={busy} onProposal={(proposal,source)=>{if(source!==(selected?.image_path?selection:null))return;if(proposal.kind!=="generate"&&!selected?.image_path){studio.setError("Choose a thumbnail before preparing this action.");return;}applyDirection(proposal.prompt,proposal.title||title,proposal.kind==="analyze"?"analyze":proposal.kind==="edit"?"edit":"generate");}}/>}
              {(hydratedWorkspace!==(studio.user||"local")||studio.loading)&&<details className="creative-conversation" inert aria-busy="true" aria-label="Loading creative chat"><summary>Creative chat <span>Brainstorm, refine, then create.</span></summary></details>}
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
                {hasReviewImage && <button className="quiet-button review-editor-toggle" aria-expanded={showComposer} aria-controls="review-creation-controls" onClick={() => setComposerOpen((open) => !open)}>{showComposer ? "Hide prompt and settings" : "Show prompt and settings"}<ChevronDown size={14} /></button>}
                <div className="composer" id="review-creation-controls" hidden={!showComposer}>
                  <fieldset className="composer-inner" disabled={navigating||studio.loading} aria-label="Thumbnail inputs">
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
                          <button aria-label="Choose references from library" onClick={() => setDialog("references")}>
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
                          aria-describedby={tool === "analyze" ? "video-title-guidance" : undefined}
                        />
                      </div>
                    )}
                    {tool==="analyze"&&providerControls}
                    {tool === "analyze" && (
                      <div className="diagnostic-context">
                        <p id="video-title-guidance">Use the title viewers will see, or add a YouTube video link to retrieve it. No written summary is required.</p>
                        <label htmlFor="analysis-video-url">YouTube video link (optional)</label>
                        <input id="analysis-video-url" type="url" maxLength={500} value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                        <p>A connected YouTube API key can retrieve the public title and description. This does not watch the video or verify its contents.</p>
                        <p className="analysis-provider-note">{analysisReviewer ? "Jev scoring + "+analysisReviewer+" image review. Uses two provider requests." : "Jev scoring. Connect a Claude, OpenAI, or Google API key for image-specific guidance."}</p>
                        <small>ChatGPT and Claude plan connections do not currently provide image analysis here.</small>
                        <p>All five pillars assess the visible thumbnail and its stated promise. Missing title or provider evidence is marked “Not assessed”; no scores are invented.</p>
                        {analysisScan && <AnalysisScanner key={analysisScan.id} src={analysisScan.src} phase={analysisScan.phase} reviewer={analysisScan.reviewer}/>}
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
                              ? "What should change?"
                              : tool === "recreate"
                                ? "What should change?"
                                : tool === "title" && titleAction === "ideas"
                                  ? "Video idea"
                                  : "Describe your thumbnail"}
                          </label>
                          <span>{prompt.length}/2400</span>
                        </div>
                        <textarea
                          id="thumbnail-prompt"
                          ref={promptRef}
                          aria-invalid={promptError?true:undefined}
                          aria-describedby={promptError?"prompt-error":undefined}
                          maxLength={2400}
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder={
                            tool === "recreate"
                              ? "Describe what to change from the reference, and what should stay. For example: replace the desk with a kitchen; keep the split-screen layout."
                              : tool === "edit"
                                ? "Name the change and what to keep. For example: brighten the face; keep the headline and background."
                                : tool === "title"
                                  ? "Describe your video, audience, or visual direction…"
                                  : "Who or what is the focus? Describe the scene, mood and any words to show. Put exact wording in quotation marks."
                          }
                        />
                        {promptError&&<p className="field-error" id="prompt-error" role="alert"><AlertCircle size={15} aria-hidden="true"/><span>{promptError}</span></p>}
                        {generateAction}
                          </div>
                        </div>
                        {providerControls}
                        <PromptEnhancer provider={textProvider} key={(studio.user||"local")+":"+workspaceEpoch.current} prompt={prompt} title={title} mode={tool} format={settings.format} config={studio.config} call={callCreative} disabled={busy} onApply={(before,after)=>{if(prompt===before)applyDirection(after);}}/>
                        {directionUndo&&<div className="direction-undo" role="status"><span>Direction updated. Review it before generating.</span><button className="neutral-button" disabled={prompt!==directionUndo.after} onClick={()=>{setPrompt(directionUndo.before.prompt);setTitle(directionUndo.before.title);setTool(directionUndo.before.tool);setDirectionUndo(null);}}>Undo direction change</button>{prompt!==directionUndo.after&&<small>Your newer edits are preserved; undo is unavailable.</small>}</div>}
                        <div className="public-style-chips" role="group" aria-label="Quick styles">{publicStyles.map(style=><button type="button" className="tool-chip" key={style.name} aria-label={style.name+" style"} aria-pressed={!styleId&&preset===style.name} onClick={()=>{setPreset(style.name);setStyleId("");}}>{style.name}</button>)}</div>
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
                          {!["recreate","edit","analyze"].includes(tool)&&<div className="composer-tool-group" role="group" aria-label="Image references">
                          <button
                            className="tool-chip"
                            onClick={() => uploadRef.current?.click()}
                          >
                            <ImagePlus size={15} />
                            Add references
                            {refs.length > 0 && <span>{refs.length}/6</span>}
                          </button>
                          <button
                            className="tool-chip"
                            aria-label="Import references from link"
                            onClick={() => setLinkOpen((x) => !x)}
                          >
                            <Link2 size={15} />Link
                          </button>
                          <button
                            className="tool-chip"
                            aria-label="Choose references from library"
                            onClick={() => setDialog("references")}
                          >
                            <Images size={15} />Library
                          </button>
                          </div>}
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
                        A title supports all five visible packaging pillars. Unavailable evidence stays unassessed.
                      </p>
                    ) : (
                      <>
                        {settings.model.startsWith("gemini-") && (
                          <p className="dialog-footnote">
                            Google uses its native 1K image output. Quality and
                            planning effort controls apply to Sunburst and Flare.
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
                            Generation settings
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
                              Planning effort
                              <select
                                aria-label="Planning effort"
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
                              Quality controls image detail. Planning effort controls preparation.
                              Higher settings may take longer and cost more with your provider.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </fieldset>
                  <div className="request-readiness" id="request-readiness" role="group" aria-label="Before you run">
                    <p className="request-identity">{readiness.identity}</p><p>{readiness.quantity}</p>
                    <p className="request-ready" role="status">{readiness.readiness}</p>
                    <p className="request-key"><strong>{studio.cloud?"Your connected provider creates the image.":"Free drafts. Your own AI connection for generation."}</strong> Generating images requires an OpenPikzels account and your own OpenAI or Google API key. Provider usage is billed to that account; ChatGPT and Claude subscriptions alone do not enable studio generation.{!studio.cloud&&<> <a href="/connect#api">Sign in, then connect your API key</a></>}</p>
                    <p className="request-cost">{readiness.cost} {readiness.pricingSource&&<a href={readiness.pricingSource} target="_blank" rel="noreferrer">Provider pricing</a>}</p>{readiness.apiModel&&<details><summary>Provider details</summary><p>API model: {readiness.apiModel}</p></details>}
                  </div>
                  {tool==="analyze"&&generateAction}
                </div>
                <div className="composer-footer" hidden={!showComposer}>
                  <span>
                    {tool === "analyze"
                      ? "Analysis and AI recomposition use your provider account."
                      : studio.cloud
                        ? <>{chatSaveState || "Draft changes save to your workspace."}{" "}{studio.live ? "Generation uses your connected API credits." : readiness.action === "connect" ? "Connect an API key to generate." : "Check Connections before generating."}</>
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
                  <p>Find your saved thumbnails and drafts.</p>
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
                    {search || onlyFavorites
                      ? "No creations match these filters."
                      : "Start with your next idea."}
                  </h2>
                  <p>
                    {search || onlyFavorites
                      ? "Clear your search and favorites filter to see your creations."
                      : "Upload an image, write a prompt, or save a concept."}
                  </p>
                  <button className="neutral-button" onClick={() => { if (search || onlyFavorites) { setSearch(""); setOnlyFavorites(false); } else void newChat(); }}>
                    {search || onlyFavorites ? "Clear filters" : "Create a thumbnail"}
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
              {dialog==="models"?"Image models":dialog==="inspect"?"Inspect your thumbnail":dialog==="analysis-history"?"Analysis history":dialog==="analysis"?"Thumbnail Analysis":dialog==="beforeafter"?"Compare Your Thumbnail":dialog==="feedback"?"Leave Your Feedback":dialog === "personas"
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
          {dialog==="analysis-history"&&selected&&<AnalysisHistory key={selected.id+studio.user} creationId={selected.id} read={studio.read}/>}
          {dialog==="analysis"&&score&&<AnalysisPanel score={score} busy={busy} onFix={()=>void runOneClickFix()} onAdjust={fix} fixUnavailable={fixReview?.kind==="blocked"||fixReview?.kind==="noop"} resultKey={scoreKey} arrived={scoreArrived}/>}
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
                        alt=""
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
              <button className="neutral-button full-width" disabled={activity.loading} onClick={()=>void showJobs()}>Refresh activity</button>
              {activity.active>0&&!activity.paused&&<button className="neutral-button full-width" onClick={activity.pause}>Stop waiting</button>}
              {activity.paused&&<p role="status">Status refresh paused. Provider work may still finish and use credits. This does not cancel it.</p>}
              {activity.error&&<p role="alert">{activity.error}</p>}
              <p>Reloading resumes status checks. Closing the page can interrupt automatic review; saved results stay in your library. No paid request is resubmitted by this viewer.</p>
              {!jobs.length&&<p>No API requests in this workspace yet.</p>}
              {jobs.map((j) => (
                <div className="connection-row" key={j.id}>
                  <strong>{j.operation === "generate" ? "AI generation" : j.operation === "analyze" ? "Thumbnail analysis" : "API request"}</strong>
                  <span>
                    {jobGuidance(j.state).label}
                    {` · Up to ${j.max_provider_calls} API request${j.max_provider_calls === 1 ? "" : "s"}`}
                    <small>{jobGuidance(j.state).message}</small>
                    {j.created_at&&<small>{new Date(j.created_at).toLocaleString()}</small>}
                    <small className="job-id">Request {j.id}</small>
                    {(typeof j.result?.value?.prompt==="string"||typeof j.result?.value?.reply==="string")&&<details className="job-text-result"><summary>Saved text result</summary><p>{j.result.value.prompt||j.result.value.reply}</p><small>{j.result.provider} · {j.result.model}</small><p>This saved text can be copied for review. It does not replace your current direction or run an image action.</p></details>}
                    {(()=>{const id=j.result?.creation?.id||j.result?.creations?.[0]?.id||j.result?.creationId,item=studio.creations.find(c=>c.id===id);return item?<button className="neutral-button" disabled={busy} onClick={async()=>{setDialog(null);await choose(item);}}>Open saved result</button>:null;})()}
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
                image is scored after it is created.
              </p>
              {imageModel(settings.model).provider === "google" && <p>{GEMINI_FIX_NOTICE}</p>}
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
              {studio.cloud&&<button className="neutral-button full-width" onClick={()=>void showJobs()}>View API activity</button>}
              <p className="dialog-footnote">
                Your keys are encrypted and private to your account. Agent tools
                never receive them.
              </p>
            </>
          )}
          {dialog === "login" && (studio.authClient?<AccountSignIn db={studio.authClient} onSignedIn={()=>location.assign("/connect#api")}/>:<p>Sign in is unavailable here. Your draft stays on this device. <a href="/connect#api">Open sign-in and connections</a></p>)}
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
