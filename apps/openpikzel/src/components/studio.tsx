"use client";
import {elementDefinitions} from "@/lib/elements";
import { plainError } from "@/lib/plain-error";
import {Box} from "lucide-react";
import { GridSkeleton, HistorySkeleton, ProfileSkeleton, ResultSkeleton, ScoreSkeleton } from "@/components/skeleton";
import { UndoToast } from "@/components/undo-toast";
import { createDeleteQueue } from "@/lib/delete-queue";
import { scopedComposerUndo } from "@/lib/composer-undo";
import {NativeOutputNotice} from "@/components/creative/native-output";
import {GenerationDelivery} from "@/components/creative/generation-delivery";
import {deliverImages,type DeliveryState,type ReviewStatus} from "@/lib/generation-delivery";
import type {CreativeDraft} from "@/components/creative/creative-partner";
import {ProviderChoice} from "@/components/creative/provider-choice";
import { canApplyEdit, generationReadiness } from "@/lib/generation-readiness";
import { pickVisionProvider } from "@/lib/vision-provider";
import { critiqueProviderFromScore, reviewerName, scorePlan, scoreStatusCopy, scoreStatusFromEvaluation } from "@/lib/score-on-generate";
import { canScore } from "@/lib/scorers";
import { GEMINI_FIX_NOTICE } from "@/lib/fix-plan-notice";
import { compareScore } from "@/lib/score-compare";
import { scoreTone } from "@/lib/score-tone";
import { promptValidationError } from "@/lib/prompt-validation";
import {useRequestActivity} from "@/lib/use-request-activity";
import { jobGuidance, jobOperationLabel, uncertainJobAdvice } from "@/lib/job-state";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
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
  Undo2,
  TrendingUp,
  MoreHorizontal,
  MessageSquare,
} from "lucide-react";
import type { FixPlan } from "@/lib/diagnostics";
import {AccountSignIn} from "@/components/account/sign-in";
import {libraryStyle} from "@/lib/style-library";
import { PixelConfirmation } from "@/components/pixel-confirmation";
import { imageModel } from "@/lib/image-models";
import { AnalysisScanner } from "@/components/creative/analysis-scanner";
import { ScoreAnnouncer, ScoreNumber, useScoreArrival, useScoreReveal } from "@/components/creative/score-count";
import { revealKey } from "@/lib/score-count";
import { recomposePrompt, type ScanPhase } from "@/lib/analysis-display";
import { ReviewCanvas } from "@/components/review-canvas";
import { ScoreBadge } from "@/components/creative/score-badge";
import { needsImageReview } from "@/lib/score-on-generate";
import { MediatorDetails } from "@/components/creative/mediator-details";
import { RevealImage, setRevealOwner } from "@/components/creative/image-reveal";
import { ThumbImage } from "@/components/thumb-image";
import { withViewTransition } from "@/lib/view-transition";
import { useSwipeDismiss } from "@/lib/use-swipe-dismiss";
import { createArrivals, staggerPositions } from "@/lib/image-reveal";
import {ModelTrigger,ModelPicker} from "@/components/creative/model-picker";
const AnalysisHistory=dynamic(()=>import("@/components/creative/analysis-history").then(m=>m.AnalysisHistory),{loading:()=> <p role="status">Reading history…</p>});
const AnalysisPanel=dynamic(()=>import("@/components/creative/analysis").then(m=>m.AnalysisPanel),{loading:()=> <p role="status">Opening…</p>});
const ImageInspector=dynamic(()=>import("@/components/creative/image-inspector").then(m=>m.ImageInspector),{loading:()=> <p role="status">Opening image…</p>});
const ProfileManager=dynamic(()=>import("@/components/creative/profiles").then(m=>m.ProfileManager),{loading:()=> <ProfileSkeleton/>});
const ComparisonSlider=dynamic(()=>import("@/components/creative/comparison").then(m=>m.ComparisonSlider),{loading:()=> <p role="status">Opening…</p>});
const FeedbackForm=dynamic(()=>import("@/components/creative/feedback").then(m=>m.FeedbackForm),{loading:()=> <p role="status">Opening…</p>});
import {OperationProgress} from "@/components/creative/progress";
import {usePersonaMentions,MentionMirror,MAX_PERSONAS,unmention} from "@/components/creative/mention-list";
import {ChatHistory,ChatTitle,ChatTimeline} from "@/components/creative/chat";
import { readDraftCheckpoint, writeDraftCheckpoint } from "@/lib/draft-checkpoint";
import {automaticChatTitle,thumbPath,worthSaving, type Conversation, type WorkspaceDraft} from "@/lib/workspaces";
import { useStudio } from "@/lib/use-studio";
import { DialogOverflowCue } from "@/components/dialog-overflow-cue";
import { TypingExamples } from "@/components/creative/typing-examples";
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
  | "elements"
  | "personas"
  | "styles"
  | "references"
  | "connections"
  | "fixplan"
  | "compare"
  | "jobs"
  | "login"
  | "delete-chat"
  | "help"
  | null;
const modes = [
  { id: "generate", label: "Create", icon: ImagePlus },
  { id: "analyze", label: "Score", icon: ChartNoAxesCombined },
] as const;
// OpenPikzels does one loop: create a thumbnail, score it, fix it. Older links and drafts
// that point at the retired Edit/Remix/Titles modes open Create instead.
const visibleTool = (value: string | null | undefined): Tool => (value === "analyze" ? "analyze" : "generate");
// Drafts saved before multi-persona mentions carry a single personaId.
const draftPersonas = (d: { personaIds?: string[]; personaId?: string }) => (d.personaIds?.length ? d.personaIds : d.personaId ? [d.personaId] : []).slice(0, 3);
const names: Record<Pillar, string> = {
  virality: "Virality",
  clarity: "Clarity",
  idea: "Idea",
  curiosity: "Curiosity",
  emotion: "Emotion",
};
const definitions: Record<Pillar, string> = {
  virality: "Stands out in the feed",
  clarity: "Easy to read, small",
  idea: "The idea is clear",
  curiosity: "Makes people want to click",
  emotion: "Shows a real feeling",
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
  const [legacyNotice,setLegacyNotice]=useState(false);
  const [chatToDelete,setChatToDelete]=useState<Conversation|null>(null);
  const deletedChatWorkspace=useRef(new Map<string,{chat:Conversation;selection:string|null}>());
  const [creationToDelete,setCreationToDelete]=useState<Creation|null>(null);
  const deleteCreationDialog=useRef<HTMLDialogElement>(null);
  const pendingDeletes = studio.pendingDeletes;
  const hydratedOwner=useRef(""),chatIdRef=useRef<string|null>(null),ownerUI=useRef(studio.user),userPickedTool=useRef(false);ownerUI.current=studio.user;chatIdRef.current=activeChatId;
  const [tool, setTool] = useState<Tool>("generate"),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [prompt, setPrompt] = useState(""),
    [title, setTitle] = useState(""),
    [refs, setRefs] = useState<string[]>([]),
    [personaIds, setPersonaIds] = useState<string[]>([]),
    [elementIds,setElementIds]=useState<string[]>([]),
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
  const [importedVideo,setImportedVideo]=useState<{id:string;title:string}|null>(null),[editImportedTitle,setEditImportedTitle]=useState(false);
  const [creativeDraft,setCreativeDraft]=useState<CreativeDraft>({}),[delivery,setDelivery]=useState<DeliveryState|null>(null),[reviewStatuses,setReviewStatuses]=useState<Record<string,ReviewStatus>>({});
  // The current delivery: how many images were asked for, and (for 8x/16x) which landed while the rest are still drawing.
  const [deliveryPlan,setDeliveryPlan]=useState<{requested:number;landed:string[]}>({requested:1,landed:[]});
  const [estimateMs,setEstimateMs]=useState<number|null>(null);
  // A fix's re-score says whether it beat its original (engine `comparison`); absent means nothing is shown.
  const [comparisons,setComparisons]=useState<Record<string,{improved:boolean;before:number|null;after:number|null;bestId:string}>>({});
  const [planUndo,setPlanUndo]=useState<{before:string;after:string}|null>(null);
  const [localUndo,setLocalUndo]=useState<{id:string;message:string;undo:()=>void}|null>(null);
  const localUndoQueue=useRef<ReturnType<typeof import("@/lib/delete-queue").createDeleteQueue> | null>(null);
  if(!localUndoQueue.current)localUndoQueue.current=createDeleteQueue(id=>setLocalUndo(current=>current?.id===id?null:current));
  function offerUndo(message:string,undo:()=>void,composer=false){localUndoQueue.current!.clear();const id=crypto.randomUUID(), chat=activeChatId;localUndoQueue.current!.add(id);setLocalUndo({id,message,undo:composer?scopedComposerUndo(chat,()=>chatIdRef.current,undo):undo});}
  useEffect(()=>()=>localUndoQueue.current?.clear(),[]);
  useEffect(()=>{const ids=Object.entries(pendingDeletes).filter(([,item])=>item.kind==='creations'||item.kind==='conversations').map(([id])=>id);if(dialog)ids.forEach(id=>studio.pauseDelete(id,"dialog"));else ids.forEach(id=>studio.resumeDelete(id,"dialog"));if(localUndo){if(dialog)localUndoQueue.current?.pause(localUndo.id,"dialog");else localUndoQueue.current?.resume(localUndo.id,"dialog");}},[dialog,pendingDeletes,localUndo]);
  const videoUrlOwner=useRef<string|null>(null);
  const deliveryAttempt=useRef(0),selectedIdRef=useRef<string|null>(null),scoreIntent=useRef<Record<string,{title:string;includeVision:boolean;videoUrl:string;critiqueProvider:ReturnType<typeof scorePlan>["critiqueProvider"]}>>({}),oneClickInFlight=useRef<Promise<unknown>|null>(null);selectedIdRef.current=selection;
  const [analysisScan, setAnalysisScan] = useState<{id:number;src:string;phase:ScanPhase;reviewer:string}|null>(null);
  const scanAttempt = useRef(0);
  const [textProvider,setTextProvider]=useState<"openai"|"google">("openai");
  const [videoBrief, setVideoBrief] = useState(""),
    [visionChoice, setIncludeVision] = useState<boolean|null>(null),
    [promptFocused, setPromptFocused] = useState(false),
    [fixReviews, setFixReviews] = useState<Record<string, {
      kind: string;
      plan?: FixPlan;
      token?: string;
      notice?: string;
      reason?: string;
    }>>({}),
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
  const dialogSwipe = useSwipeDismiss<HTMLDivElement>("y", () => setDialog(null), dialog === "help" || dialog === "analysis");
  const moreSwipe = useSwipeDismiss<HTMLDivElement>("y", () => { const menu = moreSwipe.ref.current?.parentElement as HTMLDetailsElement | null; if (menu) { menu.open = false; menu.querySelector<HTMLElement>("summary")?.focus(); } });
  const draftFingerprint = JSON.stringify({ prompt, title, tool, personaIds, elementIds, styleId, preset, refs, settings, parentId });
  draftFingerprintRef.current = draftFingerprint;
  // OP-10: creations that arrive this session (after this account's library loaded) may reveal once; a batch shares one arrival.
  const arrivalsRef = useRef<ReturnType<typeof createArrivals> | null>(null);
  if (!arrivalsRef.current) arrivalsRef.current = createArrivals();
  const arrivals = arrivalsRef.current;
  // The owner key matches the workspace key below (local mode has no user); studio.loading is true for a new owner until its library loads.
  const revealOwner = studio.user || "local";
  arrivals.observe(revealOwner, studio.loading, studio.creations.filter((c) => c.lineage?.origin !== "uploaded").map((c) => c.id));
  setRevealOwner(revealOwner);
  // OP-10: the newest arrival batch, in arrival order, is what the delivery card shows in the slot its placeholder held.
  const newestBatch = Math.max(0, ...studio.creations.map((c) => arrivals.arrival(c.id)?.batch ?? 0));
  const deliveredImages = newestBatch ? studio.creations.filter((c) => arrivals.arrival(c.id)?.batch === newestBatch)
    .sort((a, b) => arrivals.arrival(a.id)!.index - arrivals.arrival(b.id)!.index)
    .map(deliveredImage) : [];
  const landedImages = deliveryPlan.landed.map((id) => studio.creations.find((c) => c.id === id)).filter((c): c is Creation => !!c).map(deliveredImage);
  function comparisonNote(id: string) {
    const c = comparisons[id];
    if (!c) return null;
    return c.improved ? `${c.before ?? "–"} → ${c.after ?? "–"}` : `No gain (${c.after ?? "–"} vs ${c.before ?? "–"}) · Kept the better one`;
  }
  function deliveredImage(c: Creation) {
    return { id: c.id, src: (c.image_path && studio.images[c.image_path]) || undefined, alt: c.title, score: c.score, scoring: reviewStatuses[c.id] === "pending", note: comparisonNote(c.id) };
  }
  const selected = studio.creations.find((c) => c.id === selection) || null;
  const fixReview = (selection && fixReviews[selection]) || null;
  function setFixReview(value: (typeof fixReviews)[string] | null, id = selection) {
    if (!id) return;
    setFixReviews((current) => {
      if (!value) {
        const { [id]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [id]: value };
    });
  }
  const editSource = selected?.image_path ? selected : studio.creations.find(c=>c.id===(selected?.parent_id || parentId) && !!c.image_path) || null,
    chosenPersonas = personaIds.map((id) => studio.personas.find((p) => p.id === id)).filter((p): p is Persona => !!p),
    styleProfile = studio.styles.find((s) => s.id === styleId),
    libraryChoice = preset.startsWith("library:") ? libraryStyle(preset.slice(8)) : null,
    score =
      selected?.score && [2, 3].includes(selected.score.version)
        ? selected.score
        : null;
  // @mentions: each "@Name" in the prompt adds that persona (up to three), shown in the accent colour.
  const mentions = usePersonaMentions({ value: prompt, setValue: setPrompt, personas: [...studio.personas.map(p=>({...p,kind:"persona" as const})),...studio.elements.map(p=>({...p,kind:"element" as const}))], images: studio.images, selectedIds: [...personaIds,...elementIds], textarea: promptRef,
    onChange: (ids) => { setPersonaIds(ids.filter(id=>studio.personas.some(p=>p.id===id)));setElementIds(ids.filter(id=>studio.elements.some(p=>p.id===id))); void ensureChat().catch((e) => studio.setError(e.message)); },
    onLimit: () => studio.setError("Mention at most " + MAX_PERSONAS + " people and 3 elements in one thumbnail.") });
  const previousScoreRaw =
    selected?.mode === "fix" && selected.parent_id
      ? studio.creations.find((c) => c.id === selected.parent_id)?.score ?? null
      : null;
  const previousScore =
    previousScoreRaw && [2, 3].includes(previousScoreRaw.version)
      ? previousScoreRaw
      : null;
  const overallCompare = previousScore
    ? compareScore(previousScore.overall, score?.overall ?? null, { name: "Score", empty: "Partial" })
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
    if (initial) { setTool(visibleTool(initial)); if (["edit","recreate","title"].includes(initial)) setLegacyNotice(true); }
  }, []);
  useEffect(() => {
    const closeMore=(event:PointerEvent)=>{document.querySelectorAll<HTMLDetailsElement>('.result-more[open]').forEach(menu=>{if(!menu.contains(event.target as Node))menu.open=false;});};
    document.addEventListener('pointerdown',closeMore);return()=>document.removeEventListener('pointerdown',closeMore);
  },[]);
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
    setPersonaIds([]);setElementIds([]);
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
  // Settings → Models picks the default image model; an explicit choice in a draft still wins.
  const preferredImage=studio.config?.models?.image;
  useEffect(()=>{if(preferredImage)setSettings(s=>s.model===defaultSettings.model&&preferredImage!==s.model?{...s,model:preferredImage}:s);},[preferredImage]);
  useEffect(() => {if(advanced)requestAnimationFrame(()=>document.querySelector<HTMLElement>(".generate-dock")?.scrollIntoView({block:"end",behavior:"instant"}));},[advanced]);
  useEffect(() => { setSaveReceipt(0); }, [draftFingerprint]);
  useEffect(() => {
    if (!saveReceipt) return;
    const timer = setTimeout(() => setSaveReceipt(0), 2800);
    return () => clearTimeout(timer);
  }, [saveReceipt]);
  const busy = !!studio.busy;
  const selectedVision=pickVisionProvider(studio.config||{});
  // Image review is what makes the score specific. On by default whenever a key that can see images is connected.
  const includeVision = visionChoice ?? !!selectedVision;
  const analysisVision = includeVision;
  const analysisReviewer = includeVision && selectedVision ? reviewerName(selectedVision) : null;
  useEffect(() => { scanAttempt.current++; setAnalysisScan(null); }, [studio.user, selection]);
  const navigating=["Opening chat","Starting a new chat","Opening creation"].includes(studio.busy||"");
  const activeChat=studio.conversations.find(c=>c.id===activeChatId)||null;
  function activateChat(chat:Conversation,focus=true,preserveTool=false){
    workspaceEpoch.current++;
    const d=chat.draft;chatIdRef.current=chat.id;setActiveChatId(chat.id);localStorage.setItem("openpikzels.activeChat."+(studio.user||"local"),chat.id);
    setPrompt(d.prompt||"");setTitle(d.title||"");if(!preserveTool)setTool(modes.some(m=>m.id===d.tool)?d.tool as Tool:"generate");
    setSettings({...defaultSettings,...d.settings,batch:1});setRefs(d.refs||[]);setPersonaIds(draftPersonas(d));setElementIds((d.elementIds||[]).slice(0,3));setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setVideoUrl(d.videoUrl||"");setCreativeDraft(d.creativeDraft||{});setDelivery(null);setTitleAction(d.titleAction||"image");setIncludeVision(typeof d.includeVision==="boolean"?d.includeVision:null);setTextProvider(d.textProvider||"openai");
    const latest=studio.creations.find(c=>c.conversation_id===chat.id&&c.id===d.selection)||studio.creations.find(c=>c.conversation_id===chat.id);
    setSelection(latest?.id||null);setParentId(latest?.image_path?latest.id:latest?.parent_id||d.parentId||null);setComposerOpen(!latest?.image_path);setTab("studio");setTitles([]);setChatSaveState("");
    if(compactNavigation){setSidebar(false);if(focus)requestAnimationFrame(()=>mainRef.current?.focus());}
  }
  async function ensureChat(){
    const current=studio.conversations.find(c=>c.id===chatIdRef.current);
    // A chat kept only in memory is written now: the server action about to run references its id.
    if(current){await studio.persistConversation(current.id);return current;}
    const owner=studio.user,epoch=workspaceEpoch.current,startingChat=chatIdRef.current,initialDraft={...chatDraftRef.current,draftSavedAt:Date.now()};
    if(chatCreation.current?.owner===owner&&chatCreation.current.epoch===epoch)return chatCreation.current.promise;
    const promise=studio.createConversation().then(async chat=>{
      if(ownerUI.current!==owner)throw new Error("Your account changed. Open your current workspace again.");
      const saved={...chat,title:automaticChatTitle(initialDraft.title),draft:initialDraft,updated_at:new Date().toISOString()};
      await studio.saveConversation(saved,"draft");
      await studio.persistConversation(chat.id);
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
  async function selectProfile(kind:"persona"|"style"|"element",id:string){const owner=studio.user,startingChat=chatIdRef.current,chat=await ensureChat();
    // A persona picked in the dialog joins the ones already chosen (up to three); a style replaces the current one.
    if(kind==="element"){if(!elementIds.includes(id)&&elementIds.length>=3)throw new Error("Choose at most 3 elements.");const next=elementIds.includes(id)?elementIds:[...elementIds,id];await studio.saveConversation({...chat,draft:{...chatDraft,elementIds:next},updated_at:new Date().toISOString()},"draft");if(ownerUI.current===owner&&(chatIdRef.current===chat.id||chatIdRef.current===startingChat))setElementIds(next);return;}
    const nextPersonas=kind==="persona"?(personaIds.includes(id)?personaIds:[...personaIds,id].slice(-MAX_PERSONAS)):personaIds;
    await studio.saveConversation({...chat,draft:{...chatDraft,...(kind==="persona"?{personaIds:nextPersonas,personaId:nextPersonas[0]}:{styleId:id})},updated_at:new Date().toISOString()},"draft");if(ownerUI.current===owner&&(chatIdRef.current===chat.id||chatIdRef.current===startingChat)){if(kind==="persona")setPersonaIds(nextPersonas);else setStyleId(id);}}
  async function flushDraft(){
    const owner=studio.user,draft={...chatDraftRef.current,draftSavedAt:Date.now()};
    const meaningful=!!(draft.creativeDraft?.draft?.trim()||draft.creativeDraft?.messages?.length||draft.prompt?.trim()||draft.title?.trim()||(draft.videoBrief?.trim()||draft.videoUrl?.trim())||draft.refs?.length||draft.personaIds?.length||draft.elementIds?.length||draft.personaId||draft.styleId||draft.selection);
    if(!activeChat&&!meaningful)return;
    const chat=activeChat||await ensureChat();
    if(ownerUI.current===owner)await studio.saveConversation({...chat,draft,updated_at:new Date().toISOString()},"draft");
  }
  async function renameChat(chat:Conversation,name:string){await studio.saveConversation({...chat,title:name,updated_at:new Date().toISOString()},"title");offerUndo("Chat renamed.",()=>{void studio.run("Renaming chat",()=>studio.saveConversation({...chat,title:chat.title,updated_at:new Date().toISOString()},"title"));});}
  async function openChat(chat:Conversation){if(busy||chat.id===chatIdRef.current)return;await studio.run("Opening chat",async()=>{const owner=studio.user;await flushDraft();if(ownerUI.current===owner)activateChat(chat);});}
  function askDeleteChat(chat:Conversation){if(busy)return;setChatToDelete(chat);setDialog("delete-chat");}
  async function deleteChat(chat:Conversation){
    setDialog(null);setChatToDelete(null);
    await studio.run("Deleting chat",async()=>{
      const wasActive=chatIdRef.current===chat.id;
      // Stop autosave from recreating the chat while it is being deleted.
      if(wasActive){deletedChatWorkspace.current.set(chat.id,{chat:{...chat,draft:chatDraftRef.current},selection});workspaceEpoch.current++;chatIdRef.current=null;setActiveChatId(null);localStorage.removeItem("openpikzels.activeChat."+(studio.user||"local"));}
      studio.queueDelete("conversations",chat.id,chat.title);
      if(wasActive){startNew();setPersonaIds([]);setElementIds([]);setStyleId("");setPreset("Auto");setDelivery(null);}
    });
  }
  async function newChat(){if(busy)return;await studio.run("Starting a new chat",async()=>{await flushDraft();workspaceEpoch.current++;chatIdRef.current=null;setActiveChatId(null);localStorage.removeItem("openpikzels.activeChat."+(studio.user||"local"));startNew();});}
  useEffect(()=>{workspaceEpoch.current++;userPickedTool.current=false;setActiveChatId(null);chatCreation.current=null;setHydratedWorkspace("");hydratedOwner.current="";setPrompt("");setTitle("");setVideoBrief("");setVideoUrl("");setCreativeDraft({});setReviewStatuses({});setIncludeVision(null);setTextProvider("openai");setDelivery(null);setTitles([]);setBlindPair(null);setReviewResult("");setFixReviews({});setDialog(null);setChatSaveState("");},[studio.user]);
  useEffect(()=>{
    if(studio.loading)return;const key=studio.user||"local";if(hydratedOwner.current===key)return;hydratedOwner.current=key;
    const saved=localStorage.getItem("openpikzels.activeChat."+key),chat=studio.conversations.find(c=>c.id===saved),checkpoint=readDraftCheckpoint(localStorage,key);
    if(chat)activateChat(checkpoint?.chatId===chat.id&&checkpoint.savedAt>=(chat.draft.draftSavedAt||0)?{...chat,draft:checkpoint.draft}:chat,false,userPickedTool.current);
    else if(checkpoint&&!checkpoint.chatId){
      const d=checkpoint.draft;setPrompt(d.prompt||"");setTitle(d.title||"");if(!userPickedTool.current)setTool(visibleTool(d.tool));setSettings({...defaultSettings,...(studio.config?.models?{model:studio.config.models.image}:{}),...d.settings});
      setRefs(d.refs||[]);setPersonaIds(draftPersonas(d));setElementIds((d.elementIds||[]).slice(0,3));setStyleId(d.styleId||"");setPreset(d.preset||"Auto");setVideoBrief(d.videoBrief||"");setVideoUrl(d.videoUrl||"");setCreativeDraft(d.creativeDraft||{});setDelivery(null);setParentId(d.parentId||null);setTitleAction(d.titleAction||"image");setIncludeVision(typeof d.includeVision==="boolean"?d.includeVision:null);setTextProvider(d.textProvider||"openai");
    }
    const requested=new URL(location.href).searchParams.get("mode");
    if(!userPickedTool.current&&requested)setTool(visibleTool(requested));
    setHydratedWorkspace(key);
  },[studio.loading,studio.user,studio.conversations]);
  const chatDraft:WorkspaceDraft={prompt,title,tool,settings,refs,personaIds,elementIds,personaId:personaIds[0],styleId,preset,videoBrief,videoUrl,selection,parentId,titleAction,includeVision:visionChoice??undefined,textProvider,creativeDraft};
  const chatDraftRef=useRef(chatDraft);chatDraftRef.current=chatDraft;
  const chatDraftJSON=JSON.stringify(chatDraft);
  useEffect(()=>{
    const owner=studio.user,key=owner||"local";
    if(studio.loading||hydratedWorkspace!==key)return;
    const draft={...JSON.parse(chatDraftJSON),draftSavedAt:Date.now()} as WorkspaceDraft;
    const meaningful=worthSaving({id:activeChatId||"",title:activeChat?.title||"New chat",draft,created_at:"",updated_at:""},!!activeChatId&&studio.creations.some(c=>c.conversation_id===activeChatId));
    if(!activeChatId&&!meaningful)return;
    const checkpointSaved=writeDraftCheckpoint(localStorage,key,{chatId:activeChatId,draft});
    setChatSaveState(checkpointSaved?"Saved on this device · syncing…":"Saving draft…");
    let cancelled=false;
    const timer=setTimeout(()=>{
      void (async()=>{
        const chat=activeChat||await ensureChat();
        if(cancelled||ownerUI.current!==owner||chatIdRef.current!==chat.id)return;
        await studio.saveConversation({...chat,title:chat.title==="New chat"?automaticChatTitle(draft.title):chat.title,draft,updated_at:new Date().toISOString()},"draft");
        if(!cancelled&&ownerUI.current===owner&&chatIdRef.current===chat.id)setChatSaveState(studio.cloud?"Saved to your workspace":"Saved on this device");
      })().catch(()=>{if(!cancelled&&ownerUI.current===owner)setChatSaveState(checkpointSaved?"Saved on this device. Workspace sync failed.":"Draft not saved. Keep this page open.");});
    },300);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[activeChatId,chatDraftJSON,studio.user,studio.loading,hydratedWorkspace]);

  const changeSettings = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  function openProfiles(which: "personas" | "styles" | "elements") {
    setProfileDialogTitle(which==="personas"?"Your people":which==="elements"?"Your elements":"Your styles");
    setProfileNew(false);
    setProfileName("");
    setProfileNotes("");
    setProfileFiles([]);
    setDialog(which);
  }
  function toggleFavorite(item:Creation){void studio.run("Saving favorite",async()=>{await studio.favorite(item);offerUndo(item.favorite?"Removed from favorites.":"Added to favorites.",()=>{void studio.run("Saving favorite",()=>studio.favorite({...item,favorite:!item.favorite}));});});}
  async function choose(item:Creation, source?: HTMLElement | null){
    if(busy)return false;
    const changed=await studio.run("Opening creation",async()=>{
      const owner=studio.user;await flushDraft();if(ownerUI.current!==owner)return false;
      withViewTransition(()=>{
      if((item.conversation_id||null)!==activeChatId){
       const chat=studio.conversations.find(c=>c.id===item.conversation_id);
       if(chat)activateChat(chat,false);
       else{workspaceEpoch.current++;chatIdRef.current=null;setActiveChatId(null);setPrompt("");setRefs([]);setPersonaIds([]);setElementIds([]);setStyleId("");setVideoBrief("");setVideoUrl("");setCreativeDraft({});setDelivery(null);setPreset("Auto");localStorage.removeItem("openpikzels.activeChat."+(owner||"local"));}
      }
      setParentId(item.image_path?item.id:item.parent_id);
      setComposerOpen(false);setSaveReceipt(0);setSelection(item.id);
      setTitle(current => item.conversation_id && item.conversation_id === activeChatId ? current : (studio.conversations.find(c => c.id === item.conversation_id)?.draft.title ?? item.score?.context?.title ?? ""));
      if(item.settings)setSettings({...defaultSettings,...item.settings,batch:1});setTab("studio");
      if(compactNavigation){setSidebar(false);requestAnimationFrame(()=>mainRef.current?.focus());}
      },item.id,source);
      return true;
    });return changed===true;
  }
  async function resume(item: Creation) {
    if(!await choose(item))return;
    setComposerOpen(true);
    setPrompt(item.mode === "edit" ? "" : item.prompt);
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
    setElementIds((item.lineage?.elementIds||[]).slice(0,3));
    setPersonaIds(item.lineage?.personaIds?.length ? item.lineage.personaIds.slice(0, MAX_PERSONAS) : item.persona_id ? [item.persona_id] : []);
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
    if (!workspaceReady || !files?.length) return;
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
  // A YouTube link describes one thumbnail: forget it when a different thumbnail is selected.
  useEffect(() => { if (videoUrl && videoUrlOwner.current && selection && selection !== videoUrlOwner.current) { setVideoUrl(""); videoUrlOwner.current = null; } }, [selection, videoUrl]);
  async function importLink(link: string = url) {
    const source = link.trim();
    if (!source) return;
    await studio.run(tool === "analyze" ? "Getting the thumbnail" : "Importing reference", async () => {
      if (refs.length >= 6) throw new Error("Use up to six references.");
      const { path, videoTitle } = await studio.importReference(source);
      setRefs((r) => [...r, path]);
      setUrl("");
      setLinkOpen(false);
      // A YouTube link already names the video: use its public title and keep the link for the score.
      const isYouTube = /(^|\.)youtu(\.be|be\.com)$/.test((() => { try { return new URL(source).hostname; } catch { return ""; } })());
      if (videoTitle && (isYouTube && tool === "analyze" || !title.trim())) setTitle(videoTitle);
      if (isYouTube && tool === "analyze") setVideoUrl(source);
      if (["analyze", "edit"].includes(tool)) {
        const item = await studio.saveUploaded(
          path,
          (title.trim() || videoTitle || "Imported thumbnail"),
          (await ensureChat()).id,
        );
        if (isYouTube && tool === "analyze") { videoUrlOwner.current = item.id; setImportedVideo(videoTitle ? {id:item.id,title:videoTitle} : null); setEditImportedTitle(false); }
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
      style: styleProfile?.name || libraryChoice?.name || preset,
      libraryStyleId: !styleProfile && libraryChoice ? libraryChoice.id : null,
      personaId: null,
      personaIds,
      elementIds,
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

  // 8× and 16× run as parallel requests of up to 4 images; each knows its place in the set so the
  // mediator varies placement, background, emphasis and emotion across all of them.
  async function generateInChunks(input:any){
    const total=Number(input.settings?.batch)||1;
    if(total<=4)return studio.generate({...input,variationOffset:0,variationTotal:total});
    const chunks=Array.from({length:Math.ceil(total/4)},(_,i)=>({...input,settings:{...input.settings,batch:Math.min(4,total-i*4)},variationOffset:i*4,variationTotal:total,requestId:crypto.randomUUID()}));
    // Each chunk fills its tiles as soon as it lands, instead of the whole wall waiting for the slowest request.
    const results=await Promise.allSettled(chunks.map(async chunk=>{const result=await studio.generateChunk(chunk);await studio.load();setDeliveryPlan(plan=>({...plan,landed:[...plan.landed,...result.creations.map(c=>c.id)]}));return result;}));
    const creations=results.flatMap(r=>r.status==="fulfilled"?r.value.creations:[]);
    if(!creations.length){const first=results.find(r=>r.status==="rejected") as PromiseRejectedResult|undefined;throw first?.reason??new Error("The batch did not finish.");}
    await studio.load();
    return {creations,partial:creations.length<total};
  }
  function noteComparison(childId:string,result:unknown){
    const c=(result as {comparison?:{improved:boolean;before:number|null;after:number|null;bestId:string}}|null)?.comparison;
    if(!c||typeof c.improved!=="boolean")return;
    setComparisons(current=>({...current,[childId]:c}));
    // A fix that did not beat its original: keep the better one in view.
    if(!c.improved&&c.bestId&&c.bestId!==childId&&selectedIdRef.current===childId)setSelection(c.bestId);
  }
  async function createReviewed(input:any,onImages:(result:{creations:Creation[];partial:boolean})=>void|Promise<void>){
    const plan=scorePlan(studio.config),owner=studio.user,epoch=workspaceEpoch.current,id=++deliveryAttempt.current;
    setReviewStatuses({});
    setDeliveryPlan({requested:Math.max(1,Math.min(16,Number(input.settings?.batch)||1)),landed:[]});
    if(studio.cloud)void studio.read("/api/estimate").then((r:{medianMs?:number|null})=>{if(deliveryAttempt.current===id)setEstimateMs(typeof r?.medianMs==="number"?r.medianMs:null);}).catch(()=>{});
    return deliverImages({
      generate:()=>generateInChunks(input).then(result=>{if(deliveryAttempt.current===id)setDeliveryPlan(plan=>({...plan,landed:plan.landed.length?plan.landed:result.creations.map(c=>c.id)}));return result;}),current:()=>ownerUI.current===owner&&workspaceEpoch.current===epoch,
      onImages,onStage:(stage,reviewed,total)=>setDelivery({id,stage,reviewed,total,message:""}),
      ...(plan.review?{review:(item:Creation)=>{const intent={title:input.title||"",includeVision:plan.includeVision,videoUrl,critiqueProvider:plan.critiqueProvider};scoreIntent.current[item.id]=intent;return studio.analyze(item,intent.title,"",intent.includeVision,intent.videoUrl,intent.critiqueProvider||undefined).then(result=>{noteComparison(item.id,result);return result;});},onReview:(itemId,status)=>setReviewStatuses(current=>({...current,[itemId]:status})),holdMs:45_000}:{}),
    });
  }
  async function retryScore(jevOnly=false){
    if(!selected)return;
    const plan=scorePlan(studio.config);
    const intent=scoreIntent.current[selected.id]||{title,includeVision:plan.includeVision,videoUrl,critiqueProvider:plan.critiqueProvider};
    const id=selected.id;
    setReviewStatuses(current=>({...current,[id]:"pending"}));
    const ok=await studio.run("Retrying score",async()=>{
      const result=await studio.analyze(selected,intent.title,"",jevOnly ? false : intent.includeVision,intent.videoUrl,intent.critiqueProvider||undefined,jevOnly ? {rescore:true,scorer:"jev"} : undefined);
      noteComparison(id,result);return true;
    });
    setReviewStatuses(current=>({...current,[id]:ok?"scored":"failed"}));
    // Once every image in the batch has a score, the delivery line stops saying some didn't finish.
    if(ok)setDelivery(current=>current&&current.stage==="review-pending"&&studio.creations.filter(c=>deliveryPlan.landed.includes(c.id)).every(c=>c.id===id||!!c.score)?{...current,stage:"ready",reviewed:current.total}:current);
  }

  async function submit(scoreOnly = false) {
    if (!workspaceReady) return;
    if (!scoreOnly && tool==="edit" && !canApplyEdit(prompt,editSource?.prompt)) { setPromptError("Describe a new change to apply."); return; }
    // Prompt-only validation is shown under the field (not the top banner) and focuses it.
    const invalid=scoreOnly ? null : promptValidationError({tool,titleAction,prompt,title});
    if(invalid){studio.setError("");setPromptError(invalid);requestAnimationFrame(()=>promptRef.current?.focus());return;}
    setPromptError("");
    const submittedFingerprint=draftFingerprint;
    await studio.run(
      tool === "analyze" || scoreOnly
        ? "Analyzing thumbnail"
        : tool === "title" && titleAction === "ideas"
          ? "Finding title angles"
          : `Generating ${settings.batch} thumbnail${settings.batch > 1 ? "s" : ""}`,
      async () => {
        if (tool === "analyze" || scoreOnly) {
          if (!selected?.image_path)
            throw new Error(
              "Upload a thumbnail or choose one from your library.",
            );
          const attempt=++scanAttempt.current;
          setAnalysisScan({id:attempt,src:studio.images[selected.image_path],phase:"running",reviewer:analysisReviewer ? "Scoring and reviewing your image." : "Scoring your image."});
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
        if(chat.title==="New chat") await studio.saveConversation({...chat,title:automaticChatTitle(title,result.creations[0]?.title),draft:chatDraftRef.current,updated_at:new Date().toISOString()},"draft");
        if(draftFingerprintRef.current===submittedFingerprint){
          setSelection(result.creations[0].id);setComposerOpen(false);
          // OP-10: focus (and its announcement) moves to the result, but the page does not scroll: the delivered image is
          // already on screen in the delivery card, which points below to the full result.
          requestAnimationFrame(() => reviewHeadingRef.current?.focus({ preventScroll: true }));
        }else{
          setPendingResult(result.creations[0].id);
          await studio.saveConversation({...chat,draft:chatDraftRef.current,updated_at:new Date().toISOString()},"draft");
        }
        });
        if (result.partial)
          studio.setError(
            "Some images were saved, then the batch stopped. Check My creations before you try again, so you aren’t charged twice.",
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
        personaId: personaIds[0] || "",
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
      // A fix needs specific findings. If this score was made without looking at the image,
      // look at it first (one extra AI request), then fix — instead of a dead button.
      if (needsImageReview(source.score)) {
        if (!plan.critiqueProvider) throw new Error("To fix it, connect an AI account that can look at images (Claude, OpenAI or Google) in Keys.");
        const reviewTitle = scoreIntent.current[source.id]?.title || source.score?.title || source.title || title;
        if (!reviewTitle.trim()) throw new Error("Add the video title, then try the fix again.");
        await studio.analyze(source, reviewTitle, "", true, scoreIntent.current[source.id]?.videoUrl ?? videoUrl, plan.critiqueProvider);
        scoreIntent.current[source.id] = {title:reviewTitle,includeVision:true,videoUrl:scoreIntent.current[source.id]?.videoUrl ?? videoUrl,critiqueProvider:plan.critiqueProvider};
      }
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
      }) as {kind?:string;reason?:string;creations?:Creation[];scoreFailed?:boolean;comparison?:unknown}|undefined;
      if (result?.kind === "blocked" || result?.kind === "noop") {
        setFixReview({kind: result.kind, reason: result.reason}, source.id);
        return;
      }
      const child = result?.creations?.[0];
      if (child) {
        scoreIntent.current[child.id] = {title:intentTitle,includeVision,videoUrl:intentVideo,critiqueProvider:critiqueProvider||null};
        setSelection(child.id);
        selectedIdRef.current = child.id;
        setDialog(null);
        setComposerOpen(false);
        noteComparison(child.id, result);
        if (result.scoreFailed) setReviewStatuses((current)=>({...current,[child.id]:"failed"}));
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
    await studio.run("Rearranging your thumbnail", async () => {
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
    setCreationToDelete(null); deleteCreationDialog.current?.close();
    await studio.run("Deleting creation", async () => {
      await studio.remove("creations", item.id);
      if (selection === item.id) setSelection(null);
    });
  }
  const queueCreationDelete=(item: Creation)=>studio.queueDelete("creations",item.id,item.title||"Creation");
  const undoCreationDelete=(id:string)=>{studio.undoDelete(id);const previous=deletedChatWorkspace.current.get(id);if(previous){deletedChatWorkspace.current.delete(id);activateChat(previous.chat,false);setSelection(previous.selection);}};
  const filtered = studio.creations.filter(
    (c) => !pendingDeletes[c.id] && !(c.conversation_id && pendingDeletes[c.conversation_id]) &&
      (!onlyFavorites || c.favorite) &&
      `${c.title} ${c.prompt}`.toLowerCase().includes(search.toLowerCase()),
  );
  function openReviewEditor(mode: "edit" | "analyze") {
    if (!selected) return;
    setComposerOpen(true);
    setTool(mode);
    if (mode === "edit") { setParentId(selected.id); setPrompt(""); }
    // Keep the user's video title; selected.title may only be an asset label.
    requestAnimationFrame(() => {
      document.getElementById(mode === "analyze" ? "video-title" : "thumbnail-prompt")?.focus({ preventScroll: true });
      document.querySelector(".creation-workbench")?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  /** A delivered tile was tapped: review that image right here, below the grid. */
  function reviewDelivered(id: string) {
    setSelection(id); setParentId(id); setComposerOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!matchMedia("(max-width: 760px)").matches) return;
      const panel = document.querySelector<HTMLElement>(".review-inspector") || document.querySelector<HTMLElement>(".result-section");
      if (!panel) return;
      const box = panel.getBoundingClientRect();
      if (box.top >= 0 && box.top < innerHeight - 120) return;
      panel.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }));
  }
  /** The score badge on any thumbnail opens that image's full score. */
  function openScore(item: Creation) {
    if (item.conversation_id && item.conversation_id === activeChatId && tab === "studio") { setSelection(item.id); setParentId(item.image_path ? item.id : item.parent_id); setDialog("analysis"); return; }
    void choose(item).then((ok) => { if (ok) setDialog("analysis"); });
  }
  async function planIt() {
    const before = prompt;
    if (!before.trim()) return;
    await studio.run("Improving your prompt", async () => {
      studio.requireLive();
      const result = await studio.api("/api/plan", { prompt: before.trim(), title, format: settings.format, style: styleProfile?.name || libraryChoice?.name || preset });
      const brief = typeof result?.prompt === "string" ? result.prompt.trim() : typeof result?.brief === "string" ? result.brief.trim() : "";
      if (!brief) throw new Error("The improvement came back empty. Your prompt is unchanged.");
      setPrompt(brief); setPlanUndo({ before, after: brief });
      requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true }));
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
  const scoreView = score ? scoreStatusFromEvaluation(score) : !canScore(studio.config) ? {kind:"no-jev" as const} : selected && reviewStatuses[selected.id]==="pending" ? {kind:"pending" as const} : selected && reviewStatuses[selected.id]==="failed" ? {kind:"failed" as const} : {kind:"idle" as const};
  const scoreCopy = scoreStatusCopy(scoreView);
  const weakest = score ? pillars.filter(p=>score.dimensions[p].score!==null).sort((a,b)=>(score.dimensions[a].score??Infinity)-(score.dimensions[b].score??Infinity))[0] : undefined;
  const verdict: Record<Pillar,string> = {clarity:"The text is hard to read at small size.",curiosity:"It doesn’t make people wonder.",emotion:"It doesn’t show a feeling.",idea:"The idea isn’t clear.",virality:"It won’t stand out in the feed."};
  const showComposer = !hasReviewImage || composerOpen;
  const workspaceReady = !studio.loading && hydratedWorkspace === (studio.user || "local");
  const needsKey = workspaceReady && !!studio.user && studio.config?.connectionStatus === "ready" && (tool === "analyze" ? !canScore(studio.config) : !studio.config.openai && !studio.config.google);
  // Living empty state: only for a first-time visitor on an empty Create prompt.
  const showExamples = workspaceReady && tool === "generate" && !prompt && !promptFocused && !hasReviewImage && studio.creations.length === 0;
  const readiness = generationReadiness({config:studio.config,cloud:studio.cloud,loading:!workspaceReady,tool,titleIdeas:tool==="title"&&titleAction==="ideas",settings,prompt,title,hasSource:!!(tool==="edit"?editSource?.image_path:selected?.image_path),hasReferences:refs.length>0,includeVision:analysisVision,textProvider});
  // The inline prompt message follows the current text and mode, and clears once the prompt is valid.
  useEffect(()=>{if(!promptError)return;const next=promptValidationError({tool,titleAction,prompt,title})||"";if(next!==promptError)setPromptError(next);},[promptError,tool,titleAction,prompt,title]);
  // Keep the action and connection note directly under the compact prompt.
  const importedTitle = importedVideo?.id === selection && !!videoUrl;
  useEffect(() => {
    const field=promptRef.current;
    if(!field || tool!=="generate")return;
    const start=field.selectionStart,end=field.selectionEnd;
    field.style.height="auto";
    field.style.height=Math.min(240,Math.max(matchMedia("(max-width: 760px)").matches?84:88,field.scrollHeight))+"px";
    field.setSelectionRange(start,end);
  },[prompt,tool,showComposer]);
  const generateAction = (
                  <div className="generate-dock" data-placement={tool==="analyze"?"after-settings":"under-prompt"}>
                    <div className="generate-split">
                      <button type="button" data-copy-law="allow-long"
                        className={readiness.action==="loading"||readiness.action==="retry"?"neutral-button":"primary-button"}
                        disabled={busy||readiness.action==="unavailable"||readiness.action==="loading"||(tool==="edit"&&!canApplyEdit(prompt,editSource?.prompt))}
                        aria-describedby="request-ready" title={tool === "analyze" ? "Score · ⌘↵" : "Create · ⌘↵"}
                        onClick={()=>readiness.action==="signin"?setDialog("login"):readiness.action==="connect"?setDialog("connections"):readiness.action==="retry"?studio.retryConnections():submit()}
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
                            : readiness.action==="retry" ? "Retry" : readiness.action==="signin" ? "Sign in" : readiness.action==="connect" ? "Connect "+readiness.provider : readiness.action==="loading" ? "Checking…" : readiness.action==="unavailable" ? "AI unavailable" : tool === "analyze"
                              ? "Score"
                              : tool === "title" && titleAction === "ideas"
                                ? "Generate titles"
                                : tool === "edit" ? "Apply edit" : tool === "recreate" ? "Create variation" : "Create"}
                        </span>
                        {readiness.action === "run" && !busy && <small className="composer-paid-cue">Uses credits</small>}
                      </button>
                    </div>
                  </div>
  );
  const providerControls=<><ProviderChoice value={textProvider} onChange={setTextProvider} config={studio.config} disabled={busy} connectedShownNearby={readiness.keyNote.connected&&readiness.keyNote.provider===(textProvider==="openai"?"OpenAI":"Google")}/><label className="permission-field"><input type="checkbox" checked={includeVision} disabled={busy} onChange={e=>setIncludeVision(e.target.checked)}/>Review the image itself for specific advice (one extra AI request)</label></>;
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
                              : (selected.title || "Thumbnail")}
                      </ResultHeading>
                    {selected.image_path&&studio.images[selected.image_path]&&<NativeOutputNotice src={studio.images[selected.image_path]} requested={selected.style==="Uploaded"?undefined:selected.settings?.format} native={!!selected.lineage?.nativeOutput&&selected.mode!=="resize"}/>}

                    </div>
                    <div className="result-utilities">

                      <button type="button"
                        className={
                          selected.favorite
                            ? "icon-button favorited"
                            : "icon-button"
                        }
                        aria-label={selected.favorite ? "Unfavorite selected creation" : "Favorite selected creation"} title={selected.favorite ? "Unfavorite" : "Favorite"} aria-pressed={selected.favorite}
                        onClick={() => toggleFavorite(selected)}
                      >
                        <Star
                          size={16}
                          fill={selected.favorite ? "currentColor" : "none"}
                        /> {selected.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                    </div>
                  </div>
                  <div className="review-layout"><div className="review-media">
                  {selected.image_path && studio.images[selected.image_path] ? (
                    <>
                      <ReviewCanvas key={studio.images[selected.image_path]} src={studio.images[selected.image_path]} placeholderSrc={studio.thumbs[thumbPath(selected.image_path)]} title={title || selected.score?.context?.title || ""} feed={phone} portrait={selected.settings?.format === "short"} onRefresh={() => studio.run("Refreshing preview", studio.load)} creationId={selected.id} arrival={arrivals.arrival(selected.id)} badge={<ScoreBadge score={selected.score} pending={!selected.score&&reviewStatuses[selected.id]==="pending"} onOpen={score?()=>setDialog("analysis"):undefined}/>} uploaded={selected.lineage?.origin === "uploaded"} />
                      {score && <p className="result-verdict">{weakest ? `Good start. ${verdict[weakest]}` : "Score again for more detail."} {score.overall !== null && <strong>{score.overall}/100</strong>} <button type="button" className="neutral-button mobile-score-toggle" onClick={()=>setDialog("analysis")}>See scores</button></p>}
                      <div className="result-actions">
                        {score && <button type="button" data-copy-law="allow-long" className="primary-button" disabled={busy || (!!score.fixBlocked && !needsImageReview(score)) || fixReview?.kind === "blocked" || fixReview?.kind === "noop"} onClick={()=>void runOneClickFix()}><span>Fix it<small className="paid-cue">Uses credits</small></span></button>}
                        {!score && scoreView.kind!=="no-jev" && <button type="button" data-copy-law="allow-long" className="primary-button score-thumbnail-button" disabled={busy} onClick={()=>void submit(true)}><ScanLine size={15}/><span>Score<small className="paid-cue">Uses credits</small></span></button>}
                        <button type="button"
                          className={`neutral-button download-button ${score ? "has-sticky-download" : ""}`}
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
                        <details className="result-more" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))e.currentTarget.open=false;}}>
                          <summary className="neutral-button">More</summary>
                          {/* copy-law: advanced */}<div ref={moreSwipe.ref} className="result-more-menu swipe-sheet" role="group" aria-label="More actions" onClick={e=>{if((e.target as HTMLElement).closest("button") && !(e.target as HTMLElement).closest(".provenance-details")){const movesFocus=!!(e.target as HTMLElement).closest('[data-moves-focus]');const menu=e.currentTarget.parentElement as HTMLDetailsElement; menu.open=false; if(!movesFocus)requestAnimationFrame(()=>menu.querySelector<HTMLElement>('summary')?.focus());}}}>
                            <div className="swipe-handle" {...moreSwipe.handlers} aria-hidden="true"/>
                            {score&&<><button type="button" className="menu-item" data-moves-focus onClick={()=>openReviewEditor("edit")}><WandSparkles size={15}/> Edit</button><button type="button" className="menu-item" data-moves-focus onClick={()=>openReviewEditor("analyze")}><ScanLine size={15}/> Score again</button></>}
                            <button type="button" className="menu-item" disabled={busy} onClick={()=>studio.run("Downloading image",()=>studio.downloadOriginal(selected))}><Download size={15}/> Download full size</button>
                        <button type="button" className="menu-item" disabled={busy} title="Makes one new image with your AI account (uses credits). The original stays saved." data-copy-law="allow-long" onClick={resize}><RectangleVertical size={15}/> Make {selected.settings?.format === "short" ? "wide" : "vertical"} version<small> · uses credits</small></button>
                            <button type="button" className="menu-item" onClick={()=>setDialog("inspect")}><Search size={15}/> Inspect image</button><button type="button" className="menu-item" disabled={busy||!selected.parent_id} title={!selected.parent_id?"Available on a fixed or edited version":undefined} onClick={()=>setDialog("beforeafter")}><Images size={15}/> Compare before &amp; after</button><button type="button" className="menu-item" onClick={()=>setDialog("feedback")}><MessageSquare size={15}/> Leave feedback</button>
                            {studio.cloud&&selected.image_path&&<button type="button" className="menu-item" disabled={busy} onClick={()=>setDialog("analysis-history")}><RotateCcw size={15}/> Score history</button>}
                            <button type="button" className="menu-item" aria-pressed={phone} onClick={()=>setPhone(x=>!x)}><Smartphone size={15}/> Feed preview</button>
                            <details className="provenance-details"><summary>What we sent to the AI <ChevronDown size={16} aria-hidden="true"/></summary>{selected.lineage?.mediator&&<MediatorDetails record={selected.lineage.mediator}/>}<dl><dt>You wrote</dt><dd>{selected.prompt}</dd><dt>Model / quality / format</dt><dd>{selected.settings?.model||"Uploaded image"} · {selected.settings?.quality||"Original"} · {selected.settings?.format||"Source format"}</dd><dt>References</dt><dd>{selected.reference_paths?.length||0} image references · {selected.persona_id?"Persona selected":"No Persona"} · {selected.style_id?"Private Style selected":selected.style}</dd><dt>Saved</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></dl></details>
                          </div>{/* copy-law: end */}
                        </details>
                      </div>
                      {comparisons[selected.id]&&<p className="fix-outcome" data-improved={comparisons[selected.id].improved} role="status">{comparisons[selected.id].improved?<><TrendingUp size={14} aria-hidden="true"/>{comparisons[selected.id].before??"–"} → {comparisons[selected.id].after??"–"}</>:<>No gain ({comparisons[selected.id].after??"–"} vs {comparisons[selected.id].before??"–"}) · Kept the better one</>}</p>}
                    </>
                  ) : (
                    <div className="draft-preview">
                      <ImagePlus size={28} />
                      <p>{selected.prompt}</p>
                      <span>
                        {selected.status === "draft"
                          ? (readiness.action==="signin"?"Your description is saved on this device. Sign in when you’re ready to make the image.":readiness.action==="connect"?"Your description is saved. Connect your "+readiness.provider+" API key to generate.":"Your description is saved. Make the image whenever you’re ready; it uses your AI account’s credits.")
                          : selected.status === "failed"
                            ? "This image didn’t finish. Your description is saved. Check My creations before you try again."
                            : selected.status === "ready"
                              ? "This image preview is unavailable. Refresh the preview to check again."
                              : selected.status === "reconciling"
                                ? "We couldn’t confirm whether this finished. Check My creations (and your AI account’s history) before you try again, so you aren’t charged twice."
                                : "This image is still being made. Check My creations before you start another."}
                      </span>
                      {selected.status === "ready" && <button type="button" className="neutral-button" disabled={busy} onClick={() => studio.run("Refreshing preview", studio.load)}>Refresh preview</button>}
                      <button type="button"
                        className="neutral-button"
                        onClick={() => resume(selected)}
                      >
                        Continue editing
                      </button>
                    </div>
                  )}
                  {selected.mode === "fix" && selected.parent_id && (
                    <div className="original-link">
                      <button type="button"
                        onClick={() => {
                          const original = studio.creations.find(
                            (c) => c.id === selected.parent_id,
                          );
                          if (original) choose(original);
                        }}
                      >
                        <ArrowLeft size={14} />
                        View original
                      </button>
                      <span>Your original is preserved.</span>
                      <button type="button"
                        className="neutral-button"
                        disabled={busy}
                        onClick={compare}
                      >
                        Compare
                      </button>
                    </div>
                  )}
                  </div>
                  {(reviewStatuses[selected.id] === "pending" || analysisScan?.phase === "running") ? <ScoreSkeleton/> : score ? (
                    <aside className="score-panel review-inspector" aria-label="Scoring inspector" data-reveal={scoreReveal.running ? "running" : "settled"}>
                      <div className="score-header">
                        <div>
                          <span>OpenPikzels Score</span>
                          <h2 aria-label={overallCompare?.spoken}>
                            {overallCompare && score.overall === null ? (
                              overallCompare.visible
                            ) : overallCompare && score.overall !== null ? (
                              <>
                                {previousScore?.overall ?? "Partial"} → <ScoreNumber reveal={scoreReveal} final={score.overall} />
                                {previousScore?.overall != null &&
                                  previousScore.overall !== score.overall &&
                                  ` (${score.overall > previousScore.overall ? "+" : ""}${score.overall - previousScore.overall})`}
                              </>
                            ) : score.overall === null ? (
                              "Partial"
                            ) : (
                              <ScoreNumber reveal={scoreReveal} final={score.overall} />
                            )}
                            {!overallCompare && score.overall !== null && <small>/100</small>}
                          </h2>
                          <button type="button" className="neutral-button" onClick={()=>setDialog("analysis")}>View score</button>
                        </div>
                        <div>
                        <button type="button" className="neutral-button review-first" onClick={()=>void fix()}>Review first</button>
                        {imageModel(settings.model).provider === "google" && <p>{GEMINI_FIX_NOTICE}</p>}
                        {(fixReview?.kind === "blocked" || fixReview?.kind === "noop") && fixReview.reason && (
                          <p role="status">{fixReview.reason}</p>
                        )}
                        </div>
                      </div>
                      <div className="score-body">
                        <div className="pillar-list">
                          {pillars.map((p, i) => {
                            const pillarCompare = previousScore
                              ? compareScore(previousScore.dimensions[p].score, score.dimensions[p].score, { name: names[p], empty: "Not assessed" })
                              : null;
                            return (
                            <button type="button"
                              key={p}
                              className={
                                activePillar === p ? "pillar active" : "pillar"
                              }
                              aria-pressed={activePillar === p}
                              onClick={() => setActivePillar(p)}
                              aria-label={pillarCompare?.spoken}
                            >
                              <span>{names[p]}<small>{definitions[p]}</small></span>
                              <strong>
                                {pillarCompare ? pillarCompare.visible : score.dimensions[p].score ?? "Not assessed"}
                                {!pillarCompare && score.dimensions[p].score !== null && (
                                  <small>/100</small>
                                )}
                              </strong>
                              {score.dimensions[p].score !== null && (
                                <span className="pillar-meter" data-tone={scoreTone(score.dimensions[p].score)} key={scoreReveal.run} style={{ "--i": i } as CSSProperties}>
                                  <progress
                                    aria-label={`${names[p]} score`}
                                    max={100}
                                    value={score.dimensions[p].score!}
                                  />
                                </span>
                              )}
                            </button>
                            );
                          })}
                        </div>
                        <div className="pillar-detail">
                          <h3>{names[activePillar]}</h3>
                          <p>
                            {score.dimensions[activePillar].missingReason ||
                              score.dimensions[activePillar].observation}
                          </p>
                          {score.dimensions[activePillar].generalAdvice && <p>General advice — the image review gave no specific note for this pillar.</p>}
                          <dl>
                            {!!(score.dimensions[activePillar].strength||"").trim() && <><dt>Working for you</dt><dd>{score.dimensions[activePillar].strength}</dd></>}
                            {!!(score.dimensions[activePillar].weakness||"").trim() && <><dt>Holding it back</dt><dd>{score.dimensions[activePillar].weakness}</dd></>}
                            {!!(score.dimensions[activePillar].fix||"").trim() && <><dt>What to change</dt><dd>{score.dimensions[activePillar].fix}</dd></>}
                          </dl>
                          {(!(score.dimensions[activePillar].weakness||"").trim() || !(score.dimensions[activePillar].fix||"").trim()) && <p>Not assessed in detail. Score again with image review for specific advice.</p>}
                          <details><summary>Details</summary><span className="confidence">
                            AI confidence:{" "}
                            {score.dimensions[activePillar].confidence >= 0.7
                              ? "high"
                              : score.dimensions[activePillar].confidence >= 0.3
                                ? "medium"
                                : "low"}{" "}
                            (not a measured probability)
                          </span></details>
                        </div>
                      </div>
                      {score.warnings?.map((w) => (
                        <p className="score-disclaimer" key={w}>
                          {w}
                        </p>
                      ))}
                      <p className="score-disclaimer">
                        {score.note}
                      </p>
                    </aside>
                  ) : hasReviewImage ? (
                    <aside className="review-inspector review-inspector--empty" aria-label="Scoring inspector">
                      <h2>{scoreCopy.title}</h2>
                      {scoreView.kind==="idle"&&<>
                        <p>Get a score for the thumbnail and its title on five things viewers notice.</p>
                        <ul>{pillars.map((pillar) => <li key={pillar}>{names[pillar]}</li>)}</ul>
                      </>}
                      {scoreView.kind==="no-jev"&&<button type="button" className="neutral-button" onClick={()=>setDialog("connections")}>Keys</button>}
                      {scoreView.kind==="failed"&&<button type="button" data-copy-law="allow-long" className="neutral-button" disabled={busy} title="Uses credits" onClick={()=>{void retryScore();}}>Retry score<small> · uses credits</small></button>}
                      <p className="score-disclaimer">Scoring uses your AI account’s credits. Scores estimate how clear and clickable the image looks; they aren’t real click data.</p>
                    </aside>
                  ) : null}
                  </div>
                </section>
  ) : null;
  const profileKind = dialog === "personas" ? "persona" : dialog === "elements" ? "element" : "style",
    profileItems = dialog === "personas" ? studio.personas : studio.styles;
  return (
    <div
      className={`app-shell ${sidebar ? "sidebar-open" : ""}`}
      data-motion-input={motionInput}
      onPointerDownCapture={() => setMotionInput("pointer")}
    >
      <a className="skip-link" href="#studio-content">Skip to studio</a>
      {(
        <button type="button"
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
          <a className="brand" href="/studio">
            OpenPikzels
            <span className="wordmark-pixel" aria-hidden="true" />
          </a>
          <button type="button"
            className="icon-button"
            onClick={() => { setSidebar(false); requestAnimationFrame(() => navigationOpenRef.current?.focus()); }}
            ref={navigationCloseRef}
            aria-label="Close sidebar" title="Close sidebar (Cmd/Ctrl+B)"
          >
            <PanelLeft size={17} />
          </button>
        </div>
        <button type="button" className="new-chat neutral-button" disabled={busy} onClick={newChat}>
          <Plus size={16} />
          New chat
        </button>
        <div className="history-controls">
          <button type="button"
            className={tab === "library" ? "active" : ""}
            disabled={busy}
            onClick={() => { setTab("library"); if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); } }}
          >
            <FolderOpen size={14} />
            My creations
          </button>
          <button type="button"
            className="icon-button"
            aria-label="Show favorites" title="Show favorites"
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
          {studio.loading ? <HistorySkeleton/> : <ChatHistory chats={studio.conversations.filter(c=>!pendingDeletes[c.id])} creations={studio.creations.filter(c=>!pendingDeletes[c.id] && !(c.conversation_id && pendingDeletes[c.conversation_id]))} active={activeChatId} busy={busy} onOpen={chat=>{void openChat(chat);}} onDelete={askDeleteChat} onRename={renameChat}/>}
          {studio.creations.some(c=>!c.conversation_id&&!pendingDeletes[c.id])&&<p className="legacy-history-label">Recent creations</p>}
          {studio.creations.filter(c=>!c.conversation_id&&!pendingDeletes[c.id]).slice(0,8).map(item=><button type="button" key={item.id} className={"history-item "+(selection===item.id?"selected":"")} disabled={busy} onClick={()=>item.status==="draft"?resume(item):choose(item)}>{item.image_path&&studio.images[item.image_path]?<ThumbImage src={studio.thumbs[thumbPath(item.image_path)] || studio.images[item.image_path]} alt="" aspect={item.settings?.format==="short"?"9:16":"16:9"}/>:<ImagePlus size={16}/>}<span>{item.title}</span></button>)}
        </div>
        <div className="sidebar-bottom">

          <div className="profile-shortcuts">
            <button type="button" onClick={(event) => { event.currentTarget.focus({preventScroll:true}); openProfiles("personas"); }}>
              <Users size={16} />
              People
            </button>
            <button type="button" onClick={(event) => { event.currentTarget.focus({preventScroll:true}); openProfiles("styles"); }}>
              <Palette size={16} />
              Styles
            </button>
          </div>
          <p className="sidebar-workspace-status">{studio.cloud ? "Signed in · saved to your account" : "Saved on this device"}</p>
        </div>
      </aside>
      <div className="workspace-main" inert={compactNavigation && sidebar}>
        {/* OP-11: announces a newly revealed panel score once (the analysis dialog has its own region). */}
        <ScoreAnnouncer text={scoreReveal.announce} />
        <header className="topbar">
          <div className="topbar-left">
            {!sidebar && (
              <button type="button"
                className="icon-button"
                onClick={() => setSidebar(true)}
                ref={navigationOpenRef}
                aria-label="Open sidebar" title="Open sidebar (Cmd/Ctrl+B)"
              >
                <PanelLeft size={18} />
              </button>
            )}
            {!sidebar && <span className="workspace-name">OpenPikzels</span>}
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" aria-label="Help" title="Help" onClick={()=>setDialog("help")}>?</button>
            <button type="button"
              className="quiet-button"
              onClick={() => setDialog("connections")}
            >
              <SlidersHorizontal size={15} />
              <span>Keys</span>
            </button>
            {!studio.cloud && (
              <button type="button"
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
          {legacyNotice&&<div className="result-ready" role="status"><span>This old link opened Create.</span><button type="button" className="quiet-button" onClick={()=>setLegacyNotice(false)} aria-label="Dismiss old link notice"><X size={16}/></button></div>}
          {pendingResult&&<div className="result-ready" role="status"><span>Your new thumbnail is ready. Your current draft is unchanged.</span><button type="button" className="neutral-button" onClick={async()=>{const item=studio.creations.find(c=>c.id===pendingResult);if(item&&await choose(item))setPendingResult(null);}}>View result</button></div>}
          {dialog === "login" && (
            <p className="dialog-footnote">
              New here?{" "}
              <a href="/connect">Create an account and connect your keys</a>
            </p>
          )}
          {tab !== "library"&&activeChat&&<><ChatTitle key={activeChat.id} title={activeChat.title} busy={busy} onDelete={()=>askDeleteChat(activeChat)} onSave={name=>renameChat(activeChat,name)}/><span className="chat-save-state" role="status">{chatSaveState}</span></>}
          {busy&&<OperationProgress label={delivery?.stage==="analyzing"?"Analyzing saved thumbnail":studio.busy}/>}
          {delivery&&<GenerationDelivery state={delivery} portrait={settings.format==="short"} images={delivery.stage==="generating"?landedImages:deliveryPlan.landed.length?landedImages:deliveredImages} requested={deliveryPlan.requested} selectedId={selection} onSelect={reviewDelivered} onOpenScore={id=>{const item=studio.creations.find(c=>c.id===id);if(item)openScore(item);}} estimateMs={estimateMs}/>}
          <div className="undo-stack">{localUndo && <UndoToast key={localUndo.id} message={localUndo.message} onUndo={()=>{localUndoQueue.current?.undo(localUndo.id);localUndo.undo();setLocalUndo(null);}} onPause={reason=>localUndoQueue.current?.pause(localUndo.id,reason)} onResume={reason=>localUndoQueue.current?.resume(localUndo.id,reason)}/>}
          {(()=>{const entries=Object.entries(pendingDeletes).filter(([,item])=>(item.kind==="creations"||item.kind==="conversations")&&!item.committing);if(!entries.length)return null;return <UndoToast message={entries.length===1?"Deleted.":`${entries.length} deleted.`} items={entries.map(([id,item])=>({id,name:item.name,undo:()=>undoCreationDelete(id)}))} onUndo={()=>entries.forEach(([id])=>undoCreationDelete(id))} onPause={reason=>entries.forEach(([id])=>studio.pauseDelete(id,reason))} onResume={reason=>entries.forEach(([id])=>studio.resumeDelete(id,reason))}/>;})()}</div>
          {studio.error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={17} />
              <p>{plainError(studio.error).text}</p>
              {(() => { const shown = plainError(studio.error); const action = shown.action === "Retry" && !studio.canRetry() ? "My creations" : shown.action; return <button type="button" className="neutral-button" onClick={() => { studio.setError(""); if (action === "Connect") setDialog("connections"); else if (action === "Retry") studio.retryLastAction(); else if (action === "My creations") setTab("library"); }}>{action === "My creations" && shown.action === "Retry" ? "Check creations" : action}</button>; })()}
            </div>
          )}
          {tab === "studio" ? (
            <>
              {studio.loading && <ResultSkeleton/>}
              {hasReviewImage && resultPanel}
              {hasReviewImage && score && <div className="mobile-result-actions"><button type="button" data-copy-law="allow-long" className="primary-button" disabled={busy || (!!score.fixBlocked && !needsImageReview(score)) || fixReview?.kind === "blocked" || fixReview?.kind === "noop"} onClick={()=>void runOneClickFix()}><span>Fix it<small className="paid-cue">Uses credits</small></span></button><button type="button" className="neutral-button" onClick={()=>studio.run("Downloading image",()=>studio.download(selected!))}>Download</button></div>}
              {activeChatId&&<ChatTimeline items={studio.creations.filter(c=>c.conversation_id===activeChatId&&!pendingDeletes[c.id])} images={studio.images} thumbs={studio.thumbs} active={selection} onChoose={(c,source)=>c.status==="draft"?resume(c):choose(c,source)} onOpenScore={openScore} arrivalOf={arrivals.arrival}/>}
              {!hasReviewImage && <p className="studio-help"><a href="mailto:derrickserna.ca@gmail.com">Need help? Email us</a></p>}
              {needsKey && <section className="key-first"><h2>One step before you start</h2><p>Add an AI key. It lets OpenPikzels make images for you.</p><a className="primary-button" href="/connect">Add key</a></section>}
              <section
                className={`creation-workbench ${hasReviewImage ? "creation-workbench--review" : ""}`}
                aria-label="Thumbnail workspace"
                aria-busy={busy}
              >
                <div className="workbench-heading">
                  <ComposerHeading>
                    {tool === "analyze" ? "Score your thumbnail" : hasReviewImage ? "Make another"
                      : tool === "edit"
                        ? "Change your thumbnail"
                        : tool === "recreate"
                          ? "Remix a thumbnail"
                          : tool === "title"
                            ? "Find a great title"
                            : "What will you create?"}
                  </ComposerHeading>
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="Creation mode"
                  >
                    {tool === "edit" && <button type="button" role="tab" aria-selected="true" className="active" onClick={()=>{setTool("generate");setPrompt("");}} title="Exit editing">Editing: {editSource?.title || "thumbnail"} <X size={15} aria-label="Exit edit"/></button>}
                    {modes.map(({ id, label, icon: Icon }) => (
                      <button type="button"
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
                          userPickedTool.current = true;
                          setTool(modes[next].id);
                          if (hasReviewImage) setComposerOpen(true);
                          setTitles([]);
                          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                        }}
                        className={tool === id ? "active" : ""}
                        onClick={() => {
                          userPickedTool.current = true;
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
                {hasReviewImage && <button type="button" className="quiet-button review-editor-toggle" aria-expanded={showComposer} aria-controls="review-creation-controls" onClick={() => setComposerOpen((open) => !open)}>{showComposer ? "Hide settings" : "Show settings"}<ChevronDown size={14} /></button>}
                <div className="composer" id="review-creation-controls" hidden={!showComposer}>
                  <fieldset className="composer-inner" disabled={navigating||!workspaceReady} aria-label="Thumbnail inputs">
                    {tool === "title" && (
                      <div className="output-choice">
                        <button type="button"
                          className={titleAction === "image" ? "active" : ""}
                          onClick={() => setTitleAction("image")}
                        >
                          <ImagePlus size={14} />
                          From title
                        </button>
                        <button type="button"
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
                          <button type="button"
                            className={!linkOpen ? "active" : ""}
                            onClick={() => {
                              setLinkOpen(false);
                              uploadRef.current?.click();
                            }}
                          >
                            <Upload size={14} />
                            Upload
                          </button>
                          <button type="button"
                            className={linkOpen ? "active" : ""}
                            onClick={() => setLinkOpen(true)}
                          >
                            <Link2 size={14} />
                            Link
                          </button>
                          <button type="button" aria-label="Choose references from library" onClick={() => setDialog("references")}>
                            <Images size={14} />
                            Library
                          </button>
                        </div>
                        {linkOpen ? (
                          <div className="link-input">
                            <input
                              aria-label="Reference URL"
                              value={url}
                              autoFocus
                              onChange={(e) => setUrl(e.target.value)}
                              onPaste={(e) => {
                                // Pasting a link is the action: fetch the thumbnail (and title) right away.
                                const pasted = e.clipboardData.getData("text").trim();
                                if (/^https:\/\//.test(pasted)) { e.preventDefault(); setUrl(pasted); void importLink(pasted); }
                              }}
                              placeholder="Paste a YouTube video or image link"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void importLink();
                                }
                              }}
                            />
                            <button type="button"
                              onClick={() => void importLink()}
                              disabled={busy || !url}
                            >
                              Get thumbnail
                            </button>
                          </div>
                        ) : (
                          <button type="button"
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
                                    : "Add a thumbnail"}
                                </span>

                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    {tool === "analyze" && importedTitle && !editImportedTitle && <p className="imported-video-title">Title: {title} <button type="button" className="ghost-pill" onClick={()=>{setEditImportedTitle(true);requestAnimationFrame(()=>document.getElementById("video-title")?.focus());}}>Edit</button></p>}
                    {(tool === "title" || tool === "analyze" && (!importedTitle || editImportedTitle)) && (
                      <div className="field-block">
                        <label htmlFor="video-title">
                          <Type size={14} />
                          Video title
                        </label>
                        <input
                          id="video-title"
                          maxLength={100}
                          value={title}
                          onKeyDown={e=>{if(tool==="analyze"&&(e.metaKey||e.ctrlKey)&&e.key==="Enter"&&!busy&&readiness.action==="run"){e.preventDefault();void submit();}}}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="The title your audience will see"
                        />
                      </div>
                    )}
                    {tool === "analyze" && (
                      <div className="diagnostic-context">

                        <details className="more-options"><summary>More options</summary>
                        {!importedTitle && <><label htmlFor="analysis-video-url">YouTube video link (optional)</label>
                        <input id="analysis-video-url" type="url" maxLength={500} value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                        <p>Reads the video’s public title and description with your YouTube key. It does not watch the video.</p></>}
                        {providerControls}
                        <p className="analysis-provider-note">{analysisReviewer ? "Score + "+analysisReviewer+" image review." : "Score only. Connect Claude, OpenAI or Google for image-specific advice."}</p>
                        <p>Anything the evidence can’t support is marked “Not assessed”; no scores are invented.</p>
                        </details>
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
                        <div className={"prompt-field"+(showExamples?" prompt-field--examples":"")+(tool!=="title"&&(chosenPersonas.length||elementIds.length)&&prompt.includes("@")?" prompt-field--mentions":"")}>
                        {tool!=="title"&&(chosenPersonas.length>0||elementIds.length>0)&&prompt.includes("@")&&<MentionMirror textarea={promptRef} value={prompt} names={[...chosenPersonas.map(p=>p.name),...studio.elements.filter(e=>elementIds.includes(e.id)).map(e=>e.name)]}/>}
                        <textarea
                          id="thumbnail-prompt"
                          ref={promptRef}
                          onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!busy&&readiness.action==='run'){e.preventDefault();void submit();}}}
                          onFocus={() => setPromptFocused(true)}
                          onBlur={() => setPromptFocused(false)}
                          aria-invalid={promptError?true:undefined}
                          aria-describedby={promptError?"prompt-error":undefined}
                          maxLength={2400}
                          value={prompt}
                          {...(tool !== "title" ? mentions.inputProps : { onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value) })}
                          placeholder={
                            tool === "recreate"
                              ? "Describe what to change from the reference, and what should stay. For example: replace the desk with a kitchen; keep the split-screen layout."
                              : tool === "edit"
                                ? "For example: brighten the face, simplify the background, or enlarge the headline."
                                : tool === "title"
                                  ? "Describe your video, audience, or visual direction…"
                                  : "What's your video about?"
                          }
                        />

                        {mentions.list}
                        </div>
                        {promptError&&<p className="field-error" id="prompt-error" role="alert"><AlertCircle size={15} aria-hidden="true"/><span>{promptError}</span></p>}

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
                              <button type="button"
                                aria-label={`Remove reference ${i + 1}`}
                                onClick={() =>
                                  { setRefs((r) => r.filter((x) => x !== path)); offerUndo("Reference removed.",()=>setRefs(current=>current.includes(path)?current:[...current.slice(0,i),path,...current.slice(i)]),true); }
                                }
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                          {studio.elements.filter(e=>elementIds.includes(e.id)).map(e=><div key={e.id} className="selection-chip-group selection-chip-group--persona"><button type="button" className="selection-chip" onClick={()=>openProfiles("elements")} aria-label={"Change element: "+e.name}>{studio.images[e.refs[0]]&&<img src={studio.images[e.refs[0]]} alt=""/>}<span className="selection-name">{e.name} · {elementDefinitions[e.kind].label}</span></button><button type="button" className="selection-remove" aria-label={"Remove element: "+e.name} onClick={()=>{setElementIds(ids=>ids.filter(id=>id!==e.id));setPrompt(text=>unmention(text,e.name));offerUndo("Object removed.",()=>{setElementIds(ids=>ids.includes(e.id)?ids:[...ids,e.id]);setPrompt(current=>current===unmention(prompt,e.name)?prompt:current);},true);document.querySelectorAll<HTMLButtonElement>('.composer-tool-group button')[2]?.focus();}}><X size={14}/></button></div>)}
                          {chosenPersonas.map(p => <div key={p.id} className="selection-chip-group selection-chip-group--persona"><button type="button" className="selection-chip" onClick={()=>openProfiles("personas")} aria-label={"Change person: "+p.name}>{studio.images[p.refs[0]]&&<img src={studio.images[p.refs[0]]} alt=""/>}<span className="selection-name">{p.name}</span></button><button type="button" className="selection-remove" aria-label={"Remove person: "+p.name} onClick={()=>{setPersonaIds(ids=>ids.filter(id=>id!==p.id));setPrompt(text=>unmention(text,p.name));offerUndo("Person removed.",()=>{setPersonaIds(ids=>ids.includes(p.id)?ids:[...ids,p.id]);setPrompt(current=>current===unmention(prompt,p.name)?prompt:current);},true);document.querySelector<HTMLButtonElement>('.composer-tool-group button')?.focus();}}><X size={14}/></button></div>)}
                          {!styleProfile && libraryChoice && <div className="selection-chip-group"><button type="button" className="selection-chip" onClick={()=>openProfiles("styles")} aria-label={"Change style: "+libraryChoice.name}><img src={libraryChoice.images[0]} alt=""/><span className="selection-name">{libraryChoice.name}</span></button><button type="button" className="selection-remove" aria-label={"Remove style: "+libraryChoice.name} onClick={()=>{setPreset("Auto");offerUndo("Style removed.",()=>setPreset(preset),true);}}><X size={11}/></button></div>}
                          {styleProfile && <div className="selection-chip-group"><button type="button" className="selection-chip" onClick={()=>openProfiles("styles")} aria-label={"Change style: "+styleProfile.name}><Palette size={13}/><span className="selection-name">{styleProfile.name}</span></button><button type="button" className="selection-remove" aria-label={"Remove style: "+styleProfile.name} onClick={()=>{setStyleId("");offerUndo("Style removed.",()=>setStyleId(styleProfile.id),true);document.querySelectorAll<HTMLButtonElement>('.composer-tool-group button')[1]?.focus();}}><X size={14}/></button></div>}
                        </div>
                        <div className="prompt-tools">
                          <div className="composer-tool-group" role="group" aria-label="Subject and style">
                          <button type="button" data-copy-law="allow-long"
                            className="tool-chip"
                            onClick={() => openProfiles("personas")}
                          >
                            <UserRoundPlus size={15} />
                            Add a person
                          </button>
                          <button type="button" data-copy-law="allow-long"
                            className="tool-chip"
                            onClick={() => openProfiles("styles")}
                          >
                            <Palette size={15} />
                            Pick a style
                          </button>
                          </div>
                          <div className="composer-tool-group format-choice"><label className="tool-chip format-chip">
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
                          </label></div>
                        </div>
                        {linkOpen && !["recreate", "edit"].includes(tool) && (
                          <div className="link-input">
                            <input
                              aria-label="Reference URL"
                              placeholder="Paste an image or YouTube URL"
                              value={url}
                              onChange={(e) => setUrl(e.target.value)}
                            />
                            <button type="button"
                              onClick={() => void importLink()}
                              disabled={busy || !url}
                            >
                              Import
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {tool === "analyze" ? (
                      null
                    ) : (
                      <>
                        <details className="more-options" open={advanced} onToggle={e=>setAdvanced((e.currentTarget as HTMLDetailsElement).open)}><summary>More options</summary>
                          {/* copy-law: advanced */}                          <div className="more-options-body"><p>Optional. The defaults work well.</p>
                        {settings.model.startsWith("gemini-") && (
                          <p className="dialog-footnote">
                            Google uses its native 1K image output. Quality and
                            thinking time controls apply to Sunburst and Flare.
                          </p>
                        )}

                        {tool === "generate" && (
                          <div className="field-block create-title">
                            <label htmlFor="create-video-title">Video title <span>(optional, gives a complete score)</span></label>
                            <input id="create-video-title" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The title your audience will see" />
                          </div>
                        )}
<div className="prompt-tools"><div className="composer-tool-group">                          <button type="button" className="tool-chip" title="A product, logo, place or outfit to include" onClick={()=>openProfiles("elements")}><Box size={15}/>Object</button>
                          </div>
                          {!["recreate","edit","analyze"].includes(tool)&&<div className="composer-tool-group" role="group" aria-label="Image references">
                          <button type="button"
                            className="tool-chip"
                            onClick={() => uploadRef.current?.click()}
                          >
                            <ImagePlus size={15} />
                            Add image
                            {refs.length > 0 && <span>{refs.length}/6</span>}
                          </button>

                          </div>}
                      {!(tool === "title" && titleAction === "ideas") && (
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
                              <option value={8}>8×</option>
                              <option value={16}>16×</option>
                            </select>
                          </label>
                        )}
                    {tool === "generate" && (planUndo && prompt === planUndo.after
                      ? <button type="button" className="ghost-pill" disabled={busy} onClick={() => { setPrompt(planUndo.before); setPlanUndo(null); requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true })); }}><Undo2 size={15} aria-hidden="true"/>Undo</button>
                      : prompt.trim().length >= 3 && studio.cloud && !!(studio.config?.openai || studio.config?.google) && <button type="button" className="ghost-pill" disabled={busy} onClick={() => void planIt()}><Sparkles size={15} aria-hidden="true"/>Improve</button>)}
</div>

                             <section className="option-group" aria-label="AI model"><h3>AI model</h3><div className="settings-row">
                              <ModelTrigger label="Rendering model" model={settings.model} expanded={dialog==="models"} onOpen={()=>setDialog("models")}/>
                            </div>{providerControls}<div className="advanced-controls">
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
                              Thinking time
                              <select
                                aria-label="Thinking time"
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
                              Quality controls image detail. Thinking time controls preparation.
                              Higher settings may take longer and cost more with your provider.
                            </p>
                          </div></section>
                          </div>{/* copy-law: end */}
                        </details>
                      </>
                    )}
                  </fieldset>
                  <p className="request-ready" id="request-ready" role="status">{readiness.action==="signin"||readiness.action==="connect"&&!readiness.connectionCheckFailed||readiness.action==="loading"||readiness.readiness.startsWith("Connection saved.")?"":readiness.readiness}</p>
                  {tool==="analyze"&&generateAction}
                  {tool!=="analyze"&&<div className="create-action">{generateAction}</div>}
                </div>
                <div className="composer-footer" hidden={!showComposer}>
                  <span>
                    {tool === "analyze"
                      ? ""
                      : studio.cloud
                        ? (chatSaveState || "Your work saves to your account.")
                        : "Your work saves on this device."}
                  </span>
                  {tool !== "analyze" && (
                    <div className="save-draft-feedback">
                      <button type="button"
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
                  disabled={!workspaceReady}
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif"
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
                      <button type="button"
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
                      <button type="button"
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
                    <button type="button"
                      className="quiet-button"
                      onClick={() => { setTab("library"); if (compactNavigation) { setSidebar(false); requestAnimationFrame(() => mainRef.current?.focus()); } }}
                    >
                      View library
                    </button>
                  </div>
                  <div className="creation-grid">
                    {cards(studio.creations.slice(0, 3))}
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
                <button type="button" className="neutral-button" onClick={newChat}>
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
                <button type="button"
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
              {studio.loading ? <GridSkeleton/> : <div className="creation-grid">{cards(filtered)}</div>}
              {!studio.loading && !filtered.length && (
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
                      : "Describe a thumbnail, upload one to score, or save an idea for later."}
                  </p>
                  <button type="button" className="neutral-button" onClick={() => { if (search || onlyFavorites) { setSearch(""); setOnlyFavorites(false); } else void newChat(); }}>
                    {search || onlyFavorites ? "Clear filters" : "Create thumbnail"}
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
      <dialog ref={deleteCreationDialog} aria-labelledby="delete-creation-title" onClose={()=>setCreationToDelete(null)} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}>
        <div className="dialog-shell"><div className="dialog-heading"><h2 id="delete-creation-title">Delete this creation?</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={()=>deleteCreationDialog.current?.close()}><X size={18}/></button></div><section className="delete-chat"><p>This permanently deletes {creationToDelete?.title || "this creation"}. This cannot be undone.</p><div className="consent-actions"><button type="button" className="quiet-button" onClick={()=>deleteCreationDialog.current?.close()}>Cancel</button><button type="button" className="danger-button" autoFocus onClick={()=>{if(creationToDelete)void deleteCreation(creationToDelete);}}>Delete creation</button></div></section></div>
      </dialog>
      <dialog
        aria-labelledby="studio-dialog-title"
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClose={() => { if (!dialogRef.current?.open) { setDialog(null); restoreDialogFocus(); } }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
      >
        <div ref={dialogSwipe.ref} className={"dialog-shell" + (dialog === "help" || dialog === "analysis" ? " swipe-sheet" : "")}>
          {(dialog === "help" || dialog === "analysis") && <div className="swipe-handle" {...dialogSwipe.handlers} aria-hidden="true"/>}
          <div className={"dialog-heading" + (dialog === "help" || dialog === "analysis" ? " swipe-heading" : "")} {...(dialog === "help" || dialog === "analysis" ? dialogSwipe.handlers : {})}>
            <h2 id="studio-dialog-title">
              {dialog==="help"?"Help":dialog==="models"?"Image models":dialog==="inspect"?"Inspect your thumbnail":dialog==="analysis-history"?"Score history":dialog==="analysis"?"Full score":dialog==="beforeafter"?"Compare before and after":dialog==="feedback"?"Leave feedback":dialog==="delete-chat"?"Delete this chat?":dialog === "personas"
                ? profileDialogTitle || "People"
                : dialog === "elements"
                  ? profileDialogTitle || "Objects"
                  : dialog === "styles"
                  ? profileDialogTitle || "Styles"
                  : dialog === "references"
                    ? "Reference library"
                    : dialog === "login"
                      ? "Your private workspace"
                      : dialog === "fixplan"
                        ? "Review one-click fix"
                        : dialog === "compare"
                          ? "Compare"
                          : dialog === "jobs"
                            ? "Activity"
                            : "Your keys"}
            </h2>
            <button type="button"
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <X size={18} />
            </button>
          </div>
          {dialog==="models"&&<ModelPicker model={settings.model} onChoose={value=>{changeSettings("model",value);setDialog(null);}}/>}
          {(dialog==="personas"||dialog==="styles"||dialog==="elements")&&<ProfileManager key={dialog+studio.user} kind={dialog==="personas"?"persona":dialog==="elements"?"element":"style"} studio={studio} onTitle={setProfileDialogTitle} selectedIds={dialog==="elements"?elementIds:dialog==="personas"?personaIds:styleId?[styleId]:[]} onChoose={id=>{void selectProfile(dialog==="personas"?"persona":dialog==="elements"?"element":"style",id).catch(e=>studio.setError(e.message));}} onPreset={name=>{setPreset(name);setStyleId("");}} onClose={()=>setDialog(null)}/>}
          {dialog==="inspect"&&selected?.image_path&&<ImageInspector key={selected.id+studio.user} src={studio.images[selected.image_path]} title={selected.title}/>}
          {dialog==="analysis-history"&&selected&&<AnalysisHistory key={selected.id+studio.user} creationId={selected.id} read={studio.read}/>}
          {dialog==="analysis"&&score&&<AnalysisPanel score={score} busy={busy} onFix={()=>void runOneClickFix()} onAdjust={fix} onRetry={()=>void retryScore(true)} fixUnavailable={fixReview?.kind==="blocked"||fixReview?.kind==="noop"} resultKey={scoreKey} arrived={scoreArrived}/>}
          {dialog==="beforeafter"&&selected&&(()=>{const original=studio.creations.find(c=>c.id===selected.parent_id);return original?.image_path&&selected.image_path?<><ComparisonSlider before={{src:studio.images[original.image_path],title:original.title}} after={{src:studio.images[selected.image_path],title:selected.title}}/>{studio.cloud&&<button type="button" className="neutral-button full-width" disabled={busy} onClick={compare}>Compare</button>}</>:<p>Choose a revised thumbnail with a saved original to compare.</p>;})()}
          {dialog==="feedback"&&selected?.image_path&&<FeedbackForm key={selected.id+studio.user} image={studio.images[selected.image_path]} title={selected.title} onSave={body=>studio.feedback(selected.id,body)}/>}
          {dialog === "help" && <><p>How it works: 1. Sign in and add your key. 2. Tap Create. 3. Tap Fix it to improve.</p><dl className="help-glossary"><dt>Thumbnail score</dt><dd>A guide to your thumbnail’s strengths.</dd><dt>Virality</dt><dd>How much your image stands out.</dd><dt>Clarity</dt><dd>How easy it is to read.</dd><dt>Idea</dt><dd>How clear your idea is.</dd><dt>Curiosity</dt><dd>Makes people want to click.</dd><dt>Emotion</dt><dd>Shows a real feeling.</dd><dt>Fix</dt><dd>Makes an improved version.</dd><dt>People</dt><dd>Saved faces for your thumbnails.</dd><dt>Styles</dt><dd>Reusable visual styles.</dd><dt>Credits</dt><dd>What your AI account charges. A thumbnail costs a few cents.</dd></dl><p>Need help? <a href="mailto:derrickserna.ca@gmail.com">Email us</a></p></>}
          {dialog === "references" && (
            <>
              <p className="dialog-description">
                Bring a saved creation into your next thumbnail.
              </p>
              <div className="reference-library">
                {studio.creations
                  .filter((c) => c.image_path)
                  .map((item) => (
                    <button type="button"
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
              <button type="button"
                className="neutral-button full-width"
                onClick={() => {
                  setDialog(null);
                  uploadRef.current?.click();
                }}
              >
                <Upload size={15} />
                Upload reference
              </button>
            </>
          )}
          {dialog === "jobs" && (
            <div className="activity-stack">
              <p>
                Check My creations before trying again.
              </p>
              <button type="button" className="neutral-button full-width" disabled={activity.loading} onClick={()=>void showJobs()}>Refresh activity</button>
              {activity.active>0&&!activity.paused&&<button type="button" className="neutral-button full-width" onClick={activity.pause}>Stop waiting</button>}
              {activity.paused&&<p role="status">Work may still finish and use credits.</p>}
              {activity.error&&<p role="alert">{activity.error}</p>}
              <p>Reloading resumes status checks. Closing the page can interrupt automatic review; saved results stay in your library. No paid request is resubmitted by this viewer.</p>
              {!activity.error&&!activity.loading&&!jobs.length&&<p>No requests yet.</p>}
              {jobs.map((j) => (
                <div className="job-row" key={j.id}>
                  <strong>{jobOperationLabel(j.operation)}</strong>
                  <div className="job-detail">
                    <div><span className="job-status">{jobGuidance(j.state).label}</span> {`Up to ${j.max_provider_calls} API request${j.max_provider_calls === 1 ? "" : "s"}`}</div>
                    {j.state === "reconciling" ? <p><strong>What to do:</strong> {uncertainJobAdvice}</p> : <p>{jobGuidance(j.state).message}</p>}
                    {j.created_at&&<time dateTime={j.created_at}>{new Date(j.created_at).toLocaleString()}</time>}
                    <div className="job-id"><span title={j.id}>Request {j.id}</span><button type="button" className="quiet-button" aria-label="Copy request ID" onClick={()=>void navigator.clipboard.writeText(j.id)}>Copy</button></div>
                    {(typeof j.result?.value?.prompt==="string"||typeof j.result?.value?.reply==="string")&&<details className="job-text-result"><summary>Saved text result</summary><p>{j.result.value.prompt||j.result.value.reply}</p><small>{j.result.provider} · {j.result.model}</small><p>This saved text can be copied for review. It does not replace your current direction or run an image action.</p></details>}
                    {(()=>{const id=j.result?.creation?.id||j.result?.creations?.[0]?.id||j.result?.creationId,item=studio.creations.find(c=>c.id===id);return item?<button type="button" className="neutral-button" disabled={busy} onClick={async()=>{setDialog(null);await choose(item);}}>Open saved result</button>:null;})()}
                  </div>
                </div>
              ))}
            </div>
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
                    <button type="button"
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
                  <button type="button"
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
                Preview changes before spending credits. Your original stays saved.
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
              <button type="button"
                className="neutral-button full-width"
                disabled={busy}
                onClick={prepareFix}
              >
                Preview
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
                    <div><dt>Image settings</dt><dd>{fixReview.plan.settings.model}</dd></div>
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
                  <button type="button" data-copy-law="allow-long"
                    className="primary-button full-width"
                    disabled={busy}
                    onClick={applyFix}
                  >
                    <span>Fix it<small className="paid-cue">Uses credits</small></span>
                  </button>
                </>
              )}
              {fixReview?.reason && <p role="status">{fixReview.reason}</p>}
            </>
          )}
          {dialog === "connections" && (
            <div className="connections-stack">
              <p className="dialog-description">
                Manage your AI keys.
              </p>
              <ul>{([["openai", "OpenAI"], ["google", "Google"], ["anthropic", "Claude"], ["youtube", "YouTube"]] as const).map(([id, name]) => <li key={id}>{name}: {!studio.config || studio.config.connectionStatus === "failed" ? "Status unavailable" : studio.config.connectionStatus === "loading" ? "Checking…" : studio.config[id] ? "Connected" : "Not connected"}</li>)}</ul>
              <a href="/connect" className="neutral-button inline-link full-width">
                Manage keys
              </a>
              {studio.cloud&&<button type="button" className="neutral-button full-width" onClick={()=>void showJobs()}>View activity</button>}
              <p className="dialog-footnote">
                Your keys are encrypted and private to your account. Agent tools
                never receive them.
              </p>
            </div>
          )}
          {dialog==="delete-chat"&&chatToDelete&&(()=>{const count=studio.creations.filter(c=>c.conversation_id===chatToDelete.id&&c.image_path).length;return <section className="delete-chat">
            <p><strong>{chatToDelete.title}</strong> and {count===0?"its draft":count===1?"its 1 thumbnail":"its "+count+" thumbnails"} will be deleted, including the image files saved in your account. You can undo for six seconds.</p>
            <p className="dialog-footnote">People, styles and images used in another chat are kept.</p>
            <div className="consent-actions"><button type="button" className="quiet-button" onClick={()=>{setDialog(null);setChatToDelete(null);}}>Cancel</button><button type="button" className="danger-button" autoFocus onClick={()=>void deleteChat(chatToDelete)}>Delete chat</button></div>
          </section>;})()}
          {dialog === "login" && (studio.authClient?<AccountSignIn db={studio.authClient} onSignedIn={()=>location.assign("/connect#api")}/>:<p>Sign in is unavailable here. Your draft stays on this device. <a href="/connect#api">Open Keys</a></p>)}
          {studio.error && (
            <p className="dialog-error" role="status">
              {plainError(studio.error).text}
            </p>
          )}
        </div>
        <DialogOverflowCue dialog={dialogRef} open={!!dialog} />
      </dialog>
    </div>
  );
  // OP-10: a batch staggers left to right in the order this grid renders it.
  function cards(items: Creation[]) {
    const stagger = staggerPositions(items.map((c) => c.id), arrivals.arrival);
    return items.map((item) => card(item, stagger));
  }
  function card(item: Creation, stagger: Map<string, number>) {
    return (
      <article className="creation-card" key={item.id}>
        <div className="thumb-frame">
        <button type="button"
          className="creation-card-image"
          disabled={busy}
          onClick={(event) =>
            item.status === "draft" ? resume(item) : choose(item, event.currentTarget.querySelector("[data-transition-creation]"))
          }
        >
          {item.image_path && studio.images[item.image_path] ? (
            <RevealImage loading="lazy" decoding="async" surface="card" index={stagger.get(item.id)} creationId={item.id} arrival={arrivals.arrival(item.id)} uploaded={item.lineage?.origin === "uploaded"} src={studio.thumbs[thumbPath(item.image_path)] || studio.images[item.image_path]} data-transition-creation={item.id} alt={item.title} />
          ) : (
            <div className="concept-thumbnail">
              <ImagePlus size={22} />
              <p>{item.prompt}</p>
            </div>
          )}
          {(item.status !== "ready" || item.settings?.format === "short") && <span>{item.status === "ready" ? "9:16" : item.status}</span>}
        </button>
        {item.image_path && studio.images[item.image_path] && <ScoreBadge score={item.score} onOpen={busy ? undefined : () => openScore(item)} label={item.title}/>}
        </div>
        <div className="creation-card-info">
          <button type="button" disabled={busy} onClick={() => choose(item)}>
            <strong>{item.title}</strong>
            <small>
              {new Date(item.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </small>
          </button>
          <button type="button"
            className={item.favorite ? "icon-button favorited" : "icon-button"}
            aria-label={`${item.favorite ? "Unfavorite" : "Favorite"} ${item.title}`} title={item.favorite ? "Unfavorite" : "Favorite"}
            aria-pressed={item.favorite}
            onClick={() => toggleFavorite(item)}
          >
            <Star size={14} fill={item.favorite ? "currentColor" : "none"} /> {item.favorite ? "Unfavorite" : "Favorite"}
          </button>
          <details className="row-menu"><summary className="icon-button" aria-label={`More options for ${item.title}`}><MoreHorizontal size={18}/></summary><div><button type="button" disabled={busy} onClick={() => queueCreationDelete(item)}><Trash2 size={14} /> Delete</button></div></details>
        </div>
      </article>
    );
  }
}
