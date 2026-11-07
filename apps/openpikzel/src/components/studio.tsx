"use client";
import { useEffect, useRef, useState } from "react";
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
  | "personas"
  | "styles"
  | "references"
  | "connections"
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
    [linkOpen, setLinkOpen] = useState(false),
    [url, setUrl] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [titleAction, setTitleAction] = useState<"image" | "ideas">("image"),
    [titles, setTitles] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [phone, setPhone] = useState(false),
    [activePillar, setActivePillar] = useState<Pillar>("clarity"),
    [tab, setTab] = useState<"studio" | "library">("studio"),
    [profileNew, setProfileNew] = useState(false),
    [profileName, setProfileName] = useState(""),
    [profileNotes, setProfileNotes] = useState(""),
    [profileFiles, setProfileFiles] = useState<File[]>([]),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null),
    uploadRef = useRef<HTMLInputElement>(null),
    mainRef = useRef<HTMLElement>(null);
  const selected = studio.creations.find((c) => c.id === selection) || null,
    persona = studio.personas.find((p) => p.id === personaId),
    styleProfile = studio.styles.find((s) => s.id === styleId),
    score = selected?.score?.version === 2 ? selected.score : null;
  useEffect(() => {
    const initial = new URL(location.href).searchParams.get("mode");
    if (modes.some((m) => m.id === initial)) setTool(initial as Tool);
    if (innerWidth < 760) setSidebar(false);
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("mode", tool);
    history.replaceState(null, "", url);
  }, [tool]);
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    setSelection(null);
    setRefs([]);
    setParentId(null);
    setPersonaId("");
    setStyleId("");
  }, [studio.user]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebar((x) => !x);
      }
    };
    addEventListener("keydown", listener);
    return () => removeEventListener("keydown", listener);
  }, []);
  const busy = !!studio.busy;
  const changeSettings = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  function openProfiles(which: "personas" | "styles") {
    setProfileNew(false);
    setProfileName("");
    setProfileNotes("");
    setProfileFiles([]);
    setDialog(which);
  }
  function choose(item: Creation) {
    setSelection(item.id);
    setTitle(item.title);
    if (item.settings)
      setSettings({ ...defaultSettings, ...item.settings, batch: 1 });
    setTab("studio");
    if (innerWidth < 760) setSidebar(false);
  }
  function resume(item: Creation) {
    choose(item);
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
    setSelection(null);
    setParentId(null);
    setPrompt("");
    setTitle("");
    setRefs([]);
    setTitles([]);
    setTab("studio");
    studio.setError("");
    if (innerWidth < 760) setSidebar(false);
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
        );
        setSelection(item.id);
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
        );
        setSelection(item.id);
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
      prompt: text.trim(),
      title,
      mode,
      style: styleProfile?.name || preset,
      personaId: personaId || null,
      styleId: styleId || null,
      parentId:
        mode === "edit" || mode === "fix"
          ? parentId || selected?.id || null
          : null,
      referencePath: refs[0] || null,
      referencePaths: refs,
      settings,
      requestId: crypto.randomUUID(),
    };
  }
  async function submit() {
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
          if (title.trim().length < 3)
            throw new Error(
              "Add the video title to analyze the complete packaging.",
            );
          await studio.analyze(selected, title);
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
        const input = payload();
        if (input.prompt.length < 8)
          throw new Error(
            "Describe your thumbnail in at least eight characters.",
          );
        if (tool === "recreate" && !refs.length)
          throw new Error("Add a thumbnail reference to recreate.");
        if (tool === "edit" && !selected?.image_path && !refs.length)
          throw new Error("Choose an image to edit.");
        const result = await studio.generate(input);
        setSelection(result.creations[0].id);
        setTitle(result.creations[0].title);
        if (result.partial)
          studio.setError(
            "Some variations finished. The remaining batch stopped; check your history before retrying.",
          );
      },
    );
  }
  async function saveDraft() {
    await studio.run("Saving draft", async () => {
      const input = payload();
      const item = await studio.saveDraft({
        prompt: input.prompt,
        title,
        mode: input.mode,
        style: input.style,
        personaId,
        styleId,
        referencePaths: refs,
        settings,
        parentId,
      });
      setSelection(item.id);
    });
  }
  async function fix() {
    if (!selected) return;
    await studio.run("Fixing packaging", async () => {
      studio.requireLive();
      const result = await studio.generate({
        ...payload("fix"),
        parentId: selected.id,
        prompt:
          "Improve the weakest packaging pillars using the analysis. Preserve the original video promise and identity.",
        title: title || selected.title,
        settings: { ...settings, batch: 1 },
        referencePath: null,
        referencePaths: [],
      });
      setSelection(result.creations[0].id);
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
  const profileKind = dialog === "personas" ? "persona" : "style",
    profileItems = dialog === "personas" ? studio.personas : studio.styles;
  return (
    <div className={`app-shell ${sidebar ? "sidebar-open" : ""}`}>
      {sidebar && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebar(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="sidebar-heading">
          <a className="wordmark" href="/">
            OpenPikzel
            <span className="wordmark-pixel" />
          </a>
          <button
            className="icon-button"
            onClick={() => setSidebar(false)}
            aria-label="Close sidebar"
          >
            <PanelLeft size={17} />
          </button>
        </div>
        <button className="new-chat neutral-button" onClick={startNew}>
          <Plus size={16} />
          New creation
        </button>
        <div className="history-controls">
          <button
            className={tab === "library" ? "active" : ""}
            onClick={() => setTab("library")}
          >
            <FolderOpen size={14} />
            My creations
          </button>
          <button
            className="icon-button"
            aria-label="Show favorites"
            onClick={() => {
              setOnlyFavorites((x) => !x);
              setTab("library");
            }}
          >
            <Star size={14} />
          </button>
        </div>
        <div className="history-list">
          {studio.loading ? (
            <div className="history-loading" aria-label="Loading creations">
              <span />
              <span />
              <span />
            </div>
          ) : studio.creations.length ? (
            studio.creations.map((item) => (
              <button
                className={`history-item ${selection === item.id ? "selected" : ""}`}
                key={item.id}
                onClick={() =>
                  item.status === "draft" ? resume(item) : choose(item)
                }
              >
                {item.image_path && studio.images[item.image_path] ? (
                  <img src={studio.images[item.image_path]} alt="" />
                ) : (
                  <ImagePlus size={16} />
                )}
                <span>{item.title}</span>
                {item.status === "draft" && <small>Draft</small>}
                {item.status === "generating" && (
                  <LoaderCircle size={13} className="spin" />
                )}
              </button>
            ))
          ) : (
            <p className="history-empty">
              Your thumbnails and ideas will appear here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-account">
            <span className="avatar">D</span>
            <div>
              <strong>Derrick’s workspace</strong>
              <small>
                {studio.cloud ? "Private cloud library" : "Local library"}
              </small>
            </div>
            <button
              className="icon-button"
              onClick={() => setDialog("connections")}
              aria-label="Connections"
            >
              <Settings2 size={16} />
            </button>
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
          <label className="sidebar-select">
            <Sparkles size={15} />
            <span>Model</span>
            <select
              aria-label="Image model"
              value={settings.model}
              onChange={(e) =>
                changeSettings("model", e.target.value as Settings["model"])
              }
            >
              <option value="flare">Flare 2.6</option>
              <option value="sunburst">Sunburst 2.6</option>
            </select>
          </label>
          <label className="sidebar-select">
            <Monitor size={15} />
            <span>Format</span>
            <select
              aria-label="Output format"
              value={settings.format}
              onChange={(e) =>
                changeSettings("format", e.target.value as Settings["format"])
              }
            >
              <option value="long">Long-form</option>
              <option value="short">Short-form</option>
            </select>
          </label>
          <button
            className="sidebar-connection"
            onClick={() => setDialog(studio.cloud ? "connections" : "login")}
          >
            {studio.cloud ? <Check size={13} /> : <Link2 size={13} />}{" "}
            {studio.cloud
              ? "Connected workspace"
              : "Connect your cloud workspace"}
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebar && (
              <button
                className="icon-button"
                onClick={() => setSidebar(true)}
                aria-label="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <span className="workspace-name">
              {sidebar ? "Personal studio" : "OpenPikzel"}
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
          ref={mainRef}
          className={tab === "library" ? "library-main" : "studio-main"}
        >
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
              <section
                className="creation-workbench"
                aria-label="Thumbnail workspace"
              >
                <div className="workbench-heading">
                  <h1>
                    {tool === "analyze"
                      ? "What’s holding it back?"
                      : tool === "edit"
                        ? "Make it exactly right."
                        : tool === "title"
                          ? "Start with a great title."
                          : "What will you create?"}
                  </h1>
                  <div
                    className="mode-tabs"
                    role="tablist"
                    aria-label="Creation mode"
                  >
                    {modes.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={tool === id}
                        className={tool === id ? "active" : ""}
                        onClick={() => {
                          setTool(id);
                          setTitles([]);
                        }}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="composer">
                  <div className="composer-inner">
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
                      <div className="source-input">
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
                    {tool !== "analyze" && (
                      <>
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
                          {persona && (
                            <button
                              className="selection-chip"
                              onClick={() => openProfiles("personas")}
                            >
                              {studio.images[persona.refs[0]] && (
                                <img
                                  src={studio.images[persona.refs[0]]}
                                  alt=""
                                />
                              )}
                              {persona.name}
                              <X
                                size={12}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPersonaId("");
                                }}
                              />
                            </button>
                          )}
                          {styleProfile && (
                            <button
                              className="selection-chip"
                              onClick={() => openProfiles("styles")}
                            >
                              <Palette size={13} />
                              {styleProfile.name}
                              <X
                                size={12}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStyleId("");
                                }}
                              />
                            </button>
                          )}
                        </div>
                        <div className="prompt-tools">
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
                        <div className="settings-row">
                          <label>
                            <Sparkles size={13} />
                            <select
                              aria-label="Rendering model"
                              value={settings.model}
                              onChange={(e) =>
                                changeSettings(
                                  "model",
                                  e.target.value as Settings["model"],
                                )
                              }
                            >
                              <option value="flare">Flare 2.6</option>
                              <option value="sunburst">Sunburst 2.6</option>
                            </select>
                          </label>
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
                  </div>
                  <div className="generate-dock">
                    <div className="generate-split">
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={submit}
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
                            : tool === "analyze"
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
                <div className="composer-footer">
                  <span>
                    {studio.live
                      ? "Your API accounts. Your creations."
                      : "Private by design. Save drafts while AI connects."}
                  </span>
                  {tool !== "analyze" && (
                    <button onClick={saveDraft} disabled={busy}>
                      <FolderOpen size={12} />
                      Save draft
                    </button>
                  )}
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  className="sr-only"
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
              {selected && (
                <section className="result-section">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {selected.status === "draft"
                          ? "Concept saved."
                          : selected.mode === "fix"
                            ? "A stronger first impression."
                            : selected.mode === "resize"
                              ? "Ready for another format."
                              : "Your thumbnail."}
                      </h2>
                      <p>{selected.title}</p>
                    </div>
                    <div className="result-utilities">
                      <button
                        className={phone ? "icon-button active" : "icon-button"}
                        aria-label="Toggle phone feed preview"
                        onClick={() => setPhone((x) => !x)}
                      >
                        <Smartphone size={16} />
                      </button>
                      <button
                        className={
                          selected.favorite
                            ? "icon-button favorited"
                            : "icon-button"
                        }
                        aria-label="Favorite selected creation"
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
                  {selected.image_path && studio.images[selected.image_path] ? (
                    <>
                      <div
                        className={`result-image ${phone ? "phone-preview" : ""} ${selected.settings?.format === "short" ? "portrait" : ""}`}
                      >
                        <img
                          src={studio.images[selected.image_path]}
                          alt={selected.title}
                        />
                      </div>
                      <div className="result-actions">
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={() => {
                            setTool("edit");
                            setParentId(selected.id);
                            setPrompt("");
                            mainRef.current?.scrollIntoView({
                              behavior: "instant",
                            });
                          }}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          className="neutral-button"
                          disabled={busy}
                          onClick={() => {
                            setTool("analyze");
                            setTitle(selected.title);
                          }}
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
                      <p className="resize-note">
                        Instant resize preserves the full image over a softly
                        extended background.
                      </p>
                    </>
                  ) : (
                    <div className="draft-preview">
                      <ImagePlus size={28} />
                      <p>{selected.prompt}</p>
                      <span>
                        {selected.status === "draft"
                          ? "This is a saved concept. Generate to render your thumbnail."
                          : selected.status === "failed"
                            ? "The last render did not finish. Your concept is safe."
                            : "The render is still processing."}
                      </span>
                      <button
                        className="neutral-button"
                        onClick={() => resume(selected)}
                      >
                        Continue editing
                      </button>
                    </div>
                  )}
                  {score && (
                    <div className="score-panel">
                      <div className="score-header">
                        <div>
                          <span>OpenPikzel Score</span>
                          <h2>
                            {score.overall}
                            <small>/100</small>
                          </h2>
                          <p>Thumbnail + title, across five pillars.</p>
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
                              onClick={() => setActivePillar(p)}
                            >
                              <span>{names[p]}</span>
                              <strong>
                                {score.dimensions[p].score}
                                <small>/100</small>
                              </strong>
                              <progress
                                max={100}
                                value={score.dimensions[p].score}
                              />
                            </button>
                          ))}
                        </div>
                        <div className="pillar-detail">
                          <h3>{names[activePillar]}</h3>
                          <p>{score.dimensions[activePillar].observation}</p>
                          <dl>
                            <dt>Working for you</dt>
                            <dd>{score.dimensions[activePillar].strength}</dd>
                            <dt>Holding it back</dt>
                            <dd>{score.dimensions[activePillar].weakness}</dd>
                            <dt>What to change</dt>
                            <dd>{score.dimensions[activePillar].fix}</dd>
                          </dl>
                          <span className="confidence">
                            Jev confidence{" "}
                            {Math.round(
                              score.dimensions[activePillar].confidence * 100,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                      <p className="score-disclaimer">
                        {score.note} Jev visual scoring is experimental.
                      </p>
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
                    </div>
                  )}
                </section>
              )}
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
                      onClick={() => setTab("library")}
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
                <button className="neutral-button" onClick={startNew}>
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
                  <button className="neutral-button" onClick={startNew}>
                    Create a thumbnail
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>OpenPikzel</span>
          <span>Made for your next upload.</span>
          <button onClick={() => setDialog("connections")}>
            Workspace settings
          </button>
        </footer>
      </div>
      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
      >
        <div className="dialog-shell">
          <div className="dialog-heading">
            <h2>
              {dialog === "personas"
                ? "Your personas"
                : dialog === "styles"
                  ? "Your styles"
                  : dialog === "references"
                    ? "Reference library"
                    : dialog === "login"
                      ? "Your private workspace"
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
          {(dialog === "personas" || dialog === "styles") && (
            <>
              {!profileNew ? (
                <>
                  <p className="dialog-description">
                    {dialog === "personas"
                      ? "Keep the same person, character or product across your thumbnails."
                      : "Give every thumbnail a consistent visual language."}
                  </p>
                  <div className="profile-collection">
                    {profileItems.map((item) => (
                      <article className="profile-item" key={item.id}>
                        <button
                          className="profile-choose"
                          onClick={() => {
                            if (dialog === "personas") setPersonaId(item.id);
                            else setStyleId(item.id);
                            setDialog(null);
                          }}
                        >
                          <div className="profile-cover">
                            {item.refs.slice(0, 3).map((path) => (
                              <img
                                key={path}
                                src={studio.images[path]}
                                alt={`${item.name} reference`}
                              />
                            ))}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <span>
                              {item.profile_status === "ready"
                                ? "Identity brief ready"
                                : `${item.refs.length} references saved`}
                            </span>
                          </div>
                          <Check
                            size={17}
                            className={
                              (dialog === "personas" ? personaId : styleId) ===
                              item.id
                                ? "profile-check checked"
                                : "profile-check"
                            }
                          />
                        </button>
                        <div className="profile-item-actions">
                          <button
                            disabled={busy}
                            onClick={() =>
                              studio.run("Preparing reference profile", () =>
                                studio.prepare(profileKind, item.id),
                              )
                            }
                          >
                            <Sparkles size={13} />
                            {item.profile_status === "ready"
                              ? "Refresh profile"
                              : "Prepare profile"}
                          </button>
                          <button
                            aria-label={`Delete ${item.name}`}
                            onClick={() => {
                              if (confirm(`Delete ${item.name}?`))
                                studio.run("Deleting profile", () =>
                                  studio.remove(
                                    dialog === "personas"
                                      ? "personas"
                                      : "styles",
                                    item.id,
                                  ),
                                );
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button
                    className="neutral-button full-width"
                    onClick={() => setProfileNew(true)}
                  >
                    <Plus size={16} />
                    Create {profileKind}
                  </button>
                  <p className="dialog-footnote">
                    Reference-guided consistency. Saved photos and a prepared
                    profile guide each generation; no fine-tuned model is
                    claimed.
                  </p>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    studio.run("Saving reference profile", async () => {
                      const item = await studio.saveProfile(
                        profileKind,
                        profileName,
                        profileNotes,
                        profileFiles,
                      );
                      if (profileKind === "persona") setPersonaId(item.id);
                      else setStyleId(item.id);
                      setProfileNew(false);
                      setProfileFiles([]);
                    });
                  }}
                >
                  <button
                    type="button"
                    className="quiet-button back-button"
                    onClick={() => setProfileNew(false)}
                  >
                    <ArrowLeft size={14} />
                    Your collection
                  </button>
                  <label>
                    Name
                    <input
                      required
                      maxLength={80}
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={
                        dialog === "personas"
                          ? "e.g. Derrick"
                          : "e.g. Cinematic documentary"
                      }
                    />
                  </label>
                  <label>
                    Creative guidance
                    <textarea
                      maxLength={800}
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder={
                        dialog === "personas"
                          ? "Details to preserve, wardrobe and expressions…"
                          : "Palette, lighting, framing and text treatment…"
                      }
                    />
                  </label>
                  <label className="profile-upload">
                    <ImagePlus size={25} />
                    <strong>
                      {profileFiles.length
                        ? `${profileFiles.length} photos selected`
                        : "Add reference photos"}
                    </strong>
                    <span>1 to 6 photos, PNG/JPG/WebP, up to 5 MB each</span>
                    <input
                      required
                      multiple
                      type="file"
                      aria-label="Profile reference photos"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        setProfileFiles(Array.from(e.target.files || []))
                      }
                    />
                  </label>
                  <button
                    className="primary-button full-width"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Saving…" : `Create ${profileKind}`}
                  </button>
                </form>
              )}
            </>
          )}
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
          {dialog === "connections" && (
            <>
              <p className="dialog-description">
                Your services power the studio. Provider keys stay on the
                server.
              </p>
              {[
                {
                  name: "OpenAI",
                  detail: "Images, edits, identity profiles and title ideas",
                  ready: studio.config?.openai,
                },
                {
                  name: "Jev AI",
                  detail: "Five-pillar image + title scoring",
                  ready: studio.config?.jev,
                },
                {
                  name: "Supabase",
                  detail:
                    "Owner sign-in, private creations and image references",
                  ready: studio.config?.cloud,
                },
                {
                  name: "AI usage",
                  detail: "Server-side activation for provider requests",
                  ready: studio.config?.ai,
                },
              ].map((item) => (
                <div className="connection-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <span
                    className={
                      item.ready ? "connection-tag ready" : "connection-tag"
                    }
                  >
                    {item.ready ? "Configured" : "Pending"}
                  </span>
                </div>
              ))}
              <p className="dialog-footnote">
                Configured means a setting is present. Account access is
                confirmed by a successful request. Local drafts stay in this
                browser and do not sync automatically.
              </p>
              {studio.cloud ? (
                <button
                  className="neutral-button full-width"
                  onClick={() =>
                    studio.run("Signing out", async () => {
                      await studio.logout();
                      setDialog(null);
                    })
                  }
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              ) : (
                <button
                  className="neutral-button full-width"
                  onClick={() => setDialog("login")}
                >
                  Sign in to cloud
                </button>
              )}
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
                Sign in with the owner account for your private Supabase
                workspace.
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
          <button onClick={() => choose(item)}>
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
