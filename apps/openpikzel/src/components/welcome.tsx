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
     <p className="welcome-lead">Describe your video, get a thumbnail, see its score and fix it in one click.</p>
     <div className="welcome-actions"><a className="welcome-primary" href="/studio">Start creating free <ArrowRight size={19}/></a><a className="welcome-secondary" href="#how-it-works">How it works <ArrowDown/></a></div>
     <p className="welcome-cost-inline">Free to try. To make images you connect your own AI account, which bills you directly. Views are not guaranteed.</p>
    </div>
   </section>
   <section id="how-it-works" className="welcome-workflow" aria-labelledby="workflow-title"><h2 id="workflow-title">Three steps.</h2>
    <div className="welcome-steps"><article><WandSparkles aria-hidden="true"/><h3>1. Describe it.</h3><p>Write what your video is about. Add your face or a style you like if you want.</p></article><article><ScanLine aria-hidden="true"/><h3>2. See the score.</h3><p>Every thumbnail gets a score from 0 to 100, with what works and what to change.</p></article><article><Layers3 aria-hidden="true"/><h3>3. Fix it.</h3><p>One click applies the changes. Your original is always kept.</p></article></div>
   </section>
   <section id="ai-access" className="welcome-access" aria-labelledby="access-title"><h2 id="access-title">Use the AI you already pay for.</h2><p className="welcome-access-lead">OpenPikzels has no subscription. You connect your own AI account once, and you can also use it from ChatGPT or Claude.</p>
    <div className="welcome-access-list">
     <a href="/connect" aria-labelledby="welcome-api-title"><KeyRound aria-hidden="true"/><div><h3 id="welcome-api-title">Generate with API keys</h3><p>Use your own OpenAI or Google connection for supported image and text tasks, and Jev for scoring. Keys are encrypted; saved values are never shown again.</p><small>Provider API pricing and available balance apply.</small></div><ArrowUpRight aria-hidden="true"/></a>
     <a href="/connect#chatgpt" aria-labelledby="welcome-plan-title"><MessageCircle aria-hidden="true"/><div><h3 id="welcome-plan-title">Check ChatGPT models and usage</h3><p>See available models and plan usage through browser sign-in. This connection alone does not generate studio images. No download required.</p><small>Sign in on OpenAI’s page using a one-time code. Plan limits apply; studio image generation uses a separate API connection.</small></div><ArrowUpRight aria-hidden="true"/></a>
     <a href="/connect#mcp" aria-labelledby="welcome-agent-title"><Plug aria-hidden="true"/><div><h3 id="welcome-agent-title">Connect an agent</h3><p>Give a compatible MCP client access to your OpenPikzels workflow. Bring an image from your chat, request a score or get a fix prompt to take back.</p><small>Provider-backed tools use your connected API access and may incur usage costs.</small></div><ArrowUpRight aria-hidden="true"/></a>
    </div>
    <p className="welcome-cost">* OpenPikzels has no subscription fee. Provider plans, API usage and optional provider credits can cost money. Connecting a subscription does not turn paid APIs into free calls. Check <a href="https://developers.openai.com/codex/auth/" target="_blank" rel="noreferrer">Codex access</a> and <a href="https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan" target="_blank" rel="noreferrer">Claude Code plan eligibility</a>.</p>
   </section>
   <section className="welcome-closing"><h2>No designer.<br/>No photoshoots.<br/><em>Less guesswork.</em></h2><a className="welcome-primary" href="/studio" aria-label="Open the thumbnail studio">Make your next thumbnail <ArrowRight size={19}/></a>
    <details className="welcome-privacy"><summary>What is stored?</summary><div><p>Local drafts, reference images, personas and styles can be saved in this browser. With a cloud account, we store your account, conversations and prompts, creations and private images, personas, styles, analyses, feedback and job metadata.</p><p>Cloud connections store encrypted API keys and connection tokens so the server can use them for your requests. Saved keys are not returned to the interface. AI requests send the necessary inputs to your selected providers, whose terms and retention policies apply.</p><p>The local companion stores its conversations and configuration on your computer, with connection secrets in a separate encrypted file vault. For that optional local route, the official CLI manages subscription credentials. The browser Codex connection instead stores encrypted access and refresh tokens on our server until you disconnect; sign-in codes expire after 15 minutes.</p></div></details>
   </section>
  </main><footer className="welcome-footer"><span>OpenPikzels · Built for the next great idea.</span><a href="/connect">Connections</a><a href="/connect#chatgpt">ChatGPT connection</a></footer>
 </div>;
}
function ArrowDown(){return <span aria-hidden="true">↓</span>}
