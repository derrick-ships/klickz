import { App } from "@modelcontextprotocol/ext-apps";
const app = new App({ name: "OpenPikzels Studio", version: "1.1.0" }, {});
const gallery = document.querySelector("#gallery")!,
  status = document.querySelector("#status")!,
  details = document.querySelector("#details")!;
let selected = "",
  imagePath = "",
  personaId = "",
  styleId = "";
let pending: { fingerprint: string; id: string } | null = null;
const field = (id: string) =>
  (document.querySelector("#" + id) as HTMLInputElement).value;
function text(tag: string, value: string, parent: Element) {
  const el = document.createElement(tag);
  el.textContent = value;
  parent.append(el);
  return el;
}
function show(data: Record<string, any>) {
  if (data.creations) {
    gallery.replaceChildren();
    for (const c of data.creations) {
      const button = document.createElement("button");
      button.className = "tile";
      button.onclick = () => {
        selected = c.id;
        void call("get_creation", { creationId: c.id });
      };
      if (c.previewUrl) {
        const img = document.createElement("img");
        img.src = c.previewUrl;
        img.alt = c.title;
        button.append(img);
      }
      text("strong", c.title || "Untitled", button);
      text("small", c.status, button);
      gallery.append(button);
    }
  }
  if (data.creation) {
    selected = data.creation.id;
    imagePath = "";
    (document.querySelector("#title") as HTMLInputElement).value =
      data.creation.title;
    details.replaceChildren();
    if (data.previewUrl) {
      const img = document.createElement("img");
      img.src = data.previewUrl;
      img.alt = data.creation.title;
      details.append(img);
    }
    text("h2", data.creation.title, details);
    if (data.creation.score) score(data.creation.score);
  }
  if (data.score) {
    if (data.creationId) selected = data.creationId;
    score(data.score);
  }
  if (data.prompt) {
    const area = document.createElement("textarea");
    area.value = data.prompt;
    area.readOnly = true;
    area.setAttribute("aria-label", "Copyable improvement prompt");
    details.append(area);
    text(
      "p",
      "Select and copy this prompt into ChatGPT with your original image.",
      details,
    );
  }
  if (data.profiles) {
    selected = "";
    imagePath = "";
    details.replaceChildren();
    for (const p of data.profiles) {
      const b = document.createElement("button");
      b.textContent = p.name;
      b.onclick = () => {
        if (data.kind === "persona") personaId = p.id;
        else styleId = p.id;
        document.querySelector("#profile-status")!.textContent =
          "Selected " + data.kind + ": " + p.name;
        void call("get_profile", { id: p.id, kind: data.kind });
      };
      details.append(b);
    }
  }
  if (data.pictures) {
    selected = "";
    imagePath = "";
    details.replaceChildren();
    text("h2", data.profile.name, details);
    for (const p of data.pictures) {
      const img = document.createElement("img");
      img.src = p.url;
      img.alt = data.profile.name;
      details.append(img);
    }
  }
  if (data.imagePath) {
    imagePath = data.imagePath;
    selected = "";
    details.replaceChildren();
    if (data.previewUrl) {
      const img = document.createElement("img");
      img.src = data.previewUrl;
      img.alt = "Uploaded thumbnail";
      details.append(img);
    }
  }
  if (data.kind === "blocked" || data.kind === "noop")
    status.textContent = data.reason;
  if (data.plan && data.token) {
    text("h3", "Review the proposed edits", details);
    for (const op of data.plan.operations) text("p", op.instruction, details);
    text("p", data.notice, details);
    const apply = document.createElement("button");
    apply.textContent = "Apply reviewed fix with my API";
    const requestId = crypto.randomUUID();
    apply.onclick = () =>
      void call("one_click_fix", { planToken: data.token, requestId });
    details.append(apply);
  }
  if (data.message) status.textContent = data.message;
}
function score(value: Record<string, any>) {
  text(
    "h3",
    `Pixel score · ${value.overall === null ? "Partial" : value.overall + "/100"}`,
    details,
  );
  for (const [pillar, d] of Object.entries(value.dimensions) as [
    string,
    Record<string, any>,
  ][]) {
    const row = document.createElement("section");
    text(
      "strong",
      `${pillar} · ${d.score === null ? "Not assessed" : d.score + "/100"}`,
      row,
    );
    text("p", d.missingReason || d.observation, row);
    text("p", d.fix, row);
    details.append(row);
  }
  text(
    "small",
    "Visual rubric; does not predict CTR or guarantee clicks.",
    details,
  );
}
async function call(name: string, args: Record<string, unknown> = {}) {
  status.textContent = "Working…";
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const result = await app.callServerTool({ name, arguments: args });
    if (result.isError)
      throw new Error(
        result.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join(" "),
      );
    show(result.structuredContent || {});
    if (!["blocked", "noop"].includes(String(result.structuredContent?.kind)))
      status.textContent = "Ready";
    return result.structuredContent || {};
  } catch (e) {
    status.textContent =
      (e instanceof Error ? e.message : "Could not complete.") +
      " Check My creations before retrying a render.";
    return null;
  } finally {
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
document
  .querySelector("#refresh")!
  .addEventListener("click", () => void call("list_creations"));
document
  .querySelector("#personas")!
  .addEventListener(
    "click",
    () => void call("list_profiles", { kind: "persona" }),
  );
document
  .querySelector("#styles")!
  .addEventListener(
    "click",
    () => void call("list_profiles", { kind: "style" }),
  );
document.querySelector("#fix")!.addEventListener("click", () => {
  if (!selected) {
    status.textContent = "Choose a scored thumbnail first.";
    return;
  }
  void call("get_fix_prompt", { creationId: selected });
});
document.querySelector("#resize")!.addEventListener("click", () => {
  if (!selected) {
    status.textContent = "Choose a thumbnail first.";
    return;
  }
  void call("resize_thumbnail", {
    creationId: selected,
    format: "short",
    requestId: crypto.randomUUID(),
  });
});
app.ontoolresult = (params) => show(params.structuredContent || {});
void app
  .connect()
  .then(() => {
    status.textContent = "Connected. Open your library to begin.";
  })
  .catch(() => {
    status.textContent =
      "Open this interface through an MCP Apps-compatible host.";
  });

document.querySelector("#score")!.addEventListener("click", () => {
  if (!selected && !imagePath) {
    status.textContent = "Choose or upload a thumbnail first.";
    return;
  }
  const args = {
    ...(selected ? { creationId: selected } : { imagePath }),
    title: field("title"),
    videoBrief: field("brief"),
    includeVision: (document.querySelector("#vision") as HTMLInputElement)
      .checked,
  };
  const fingerprint = "score:" + JSON.stringify(args);
  if (pending?.fingerprint !== fingerprint)
    pending = { fingerprint, id: crypto.randomUUID() };
  void call("score_thumbnail", { ...args, requestId: pending.id }).then(
    (result) => {
      if (result) pending = null;
    },
  );
});
document.querySelector("#generate")!.addEventListener("click", () => {
  void render(false);
});
document.querySelector("#fix-api")!.addEventListener("click", () => {
  void render(true);
});
async function render(fix: boolean) {
  if (fix && !selected) {
    status.textContent = "Choose a scored thumbnail first.";
    return;
  }
  if (!fix && field("prompt").trim().length < 8) {
    status.textContent = "Describe your thumbnail in at least 8 characters.";
    return;
  }
  const args = fix
    ? { creationId: selected, model: field("model"), quality: field("quality") }
    : {
        prompt: field("prompt"),
        title: field("title"),
        mode: "generate",
        model: field("model"),
        quality: field("quality"),
        format: field("format"),
        batch: 1,
        ...(personaId ? { personaId } : {}),
        ...(styleId ? { styleId } : {}),
        referencePaths: imagePath ? [imagePath] : [],
      };
  const fingerprint = JSON.stringify(args);
  if (pending?.fingerprint !== fingerprint)
    pending = { fingerprint, id: crypto.randomUUID() };
  const result = await call(fix ? "create_fix_plan" : "generate_thumbnail", {
    ...args,
    requestId: pending.id,
  });
  if (result) pending = null;
}
(document.querySelector("#upload") as HTMLInputElement).addEventListener(
  "change",
  async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      status.textContent = "Choose an image smaller than 2 MB.";
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await call("upload_reference", { base64: data });
  },
);
