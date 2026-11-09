import { ArrowUpRight, ArrowRight, KeyRound, MessageCircle, Plug, ScanLine, Layers3, WandSparkles } from "lucide-react";
import { BrandScene } from "@/components/brand-scene";

export function Welcome() {
 return <div className="welcome">
  <a href="#welcome-main" className="welcome-skip">Skip to introduction</a>
  <header className="welcome-header"><a className="welcome-brand" href="/welcome" aria-label="OpenPikzels home">OpenPikzels<span aria-hidden="true">.</span></a><a href="/studio" className="welcome-open">Open studio <ArrowUpRight size={16}/></a></header>
  <main id="welcome-main">
   <section className="welcome-hero" aria-labelledby="welcome-title">
    <div className="welcome-art" aria-hidden="true"><BrandScene scene="aperture"/></div>
    <div className="welcome-hero-copy"><p className="welcome-hook"><span aria-hidden="true"/>Make, test and improve your thumbnail.</p>
     <h1 id="welcome-title" className="welcome-headline"><span>GET MILLIONS</span>{" "}<span>OF VIEWS</span></h1>
     <p className="welcome-subtitle">Without adding another subscription*</p>
     <p className="welcome-lead">Your next great video deserves a thumbnail that makes people stop. Create it, compare it and make the idea unmistakable—with the AI access you already have.</p>
     <div className="welcome-actions"><a className="welcome-primary" href="/studio">Start creating free <ArrowRight size={19}/></a><a className="welcome-secondary" href="#ai-access">Choose your AI access <ArrowDown/></a></div>
     <p className="welcome-cost-inline">Start with a free local draft. Generating images requires your own API connection; provider usage charges apply.</p>
     <p className="welcome-outcome">Views are not guaranteed. Great packaging is a creative process.</p>
    </div>
    <div className="welcome-hero-index" aria-hidden="true"><span>01 / THE IDEA COMES FIRST</span><span>OPENPIKZELS · YOUR THUMBNAIL STUDIO</span></div>
   </section>
   <section className="welcome-workflow" aria-labelledby="workflow-title"><div className="welcome-section-label">ONE CONTINUOUS WORKSPACE</div><h2 id="workflow-title">From “what if”<br/>to “that’s the one.”</h2>
    <div className="welcome-steps"><article><WandSparkles aria-hidden="true"/><span>01</span><h3>Make the idea visible.</h3><p>Generate from a prompt, recreate a reference or edit an existing thumbnail. Bring your own personas and styles.</p></article><article><ScanLine aria-hidden="true"/><span>02</span><h3>See what needs work.</h3><p>Inspect Virality, Clarity, Idea, Curiosity and Emotion. Get a creative assessment with specific explanations, not a prediction of clicks.</p></article><article><Layers3 aria-hidden="true"/><span>03</span><h3>Keep the better version.</h3><p>Turn feedback into a fix, compare before and after, and keep your originals. Every refinement has a starting point.</p></article></div>
   </section>
   <section id="ai-access" className="welcome-access" aria-labelledby="access-title"><div className="welcome-section-label">YOUR AI. YOUR CHOICE.</div><h2 id="access-title">Bring the access.<br/>We bring the studio.</h2><p className="welcome-access-lead">Generate studio images with an OpenAI or Google API key. The optional ChatGPT connection shows models and plan usage; agent access lets compatible clients control your studio.</p>
    <div className="welcome-access-list">
     <a href="/connect" aria-labelledby="welcome-api-title"><KeyRound aria-hidden="true"/><div><h3 id="welcome-api-title">Generate with API keys</h3><p>Use your own OpenAI or Google connection for supported image and text tasks, and Jev for scoring. Keys are encrypted; saved values are never shown again.</p><small>Provider API pricing and available balance apply.</small></div><ArrowUpRight aria-hidden="true"/></a>
     <a href="/connect#chatgpt" aria-labelledby="welcome-plan-title"><MessageCircle aria-hidden="true"/><div><h3 id="welcome-plan-title">Check ChatGPT models and usage</h3><p>See available models and plan usage through browser sign-in. This connection alone does not generate studio images. No download required.</p><small>Sign in on OpenAI’s page using a one-time code. Plan limits apply; studio image generation uses a separate API connection.</small></div><ArrowUpRight aria-hidden="true"/></a>
     <a href="/connect#mcp" aria-labelledby="welcome-agent-title"><Plug aria-hidden="true"/><div><h3 id="welcome-agent-title">Connect an agent</h3><p>Give a compatible MCP client access to your OpenPikzels workflow. Bring an image from your chat, request a score or get a fix prompt to take back.</p><small>Provider-backed tools use your connected API access and may incur usage costs.</small></div><ArrowUpRight aria-hidden="true"/></a>
    </div>
    <p className="welcome-cost">* OpenPikzels has no subscription fee. Provider plans, API usage and optional provider credits can cost money. Connecting a subscription does not turn paid APIs into free calls. Check <a href="https://developers.openai.com/codex/auth/" target="_blank" rel="noreferrer">Codex access</a> and <a href="https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan" target="_blank" rel="noreferrer">Claude Code plan eligibility</a>.</p>
   </section>
   <section className="welcome-closing"><p className="welcome-section-label">LESS BETWEEN YOU AND THE IDEA</p><h2>No designer.<br/>No photoshoots.<br/><em>Less guesswork.</em></h2><a className="welcome-primary" href="/studio" aria-label="Open the thumbnail studio">Make your next thumbnail <ArrowRight size={19}/></a>
    <details className="welcome-privacy"><summary>What is stored?</summary><div><p>Local drafts, reference images, personas and styles can be saved in this browser. With a cloud account, we store your account, conversations and prompts, creations and private images, personas, styles, analyses, feedback and job metadata.</p><p>Cloud connections store encrypted API keys and connection tokens so the server can use them for your requests. Saved keys are not returned to the interface. AI requests send the necessary inputs to your selected providers, whose terms and retention policies apply.</p><p>The local companion stores its conversations and configuration on your computer, with connection secrets in a separate encrypted file vault. For that optional local route, the official CLI manages subscription credentials. The browser Codex connection instead stores encrypted access and refresh tokens on our server until you disconnect; sign-in codes expire after 15 minutes.</p></div></details>
   </section>
  </main><footer className="welcome-footer"><span>OpenPikzels · Built for the next great idea.</span><a href="/connect">Connections</a><a href="/connect#chatgpt">ChatGPT connection</a></footer>
 </div>;
}
function ArrowDown(){return <span aria-hidden="true">↓</span>}
