import { ArrowRight, ArrowUpRight } from "lucide-react";

export function Welcome() {
 return <div className="welcome">
  <a href="#welcome-main" className="welcome-skip">Skip to introduction</a>
  <header className="welcome-header"><a className="brand" href="/welcome">OpenPikzels<span className="wordmark-pixel" aria-hidden="true"/></a><a href="/studio" className="welcome-open">Open studio <ArrowUpRight size={16}/></a></header>
  <main id="welcome-main">
   <section className="welcome-hero" aria-labelledby="welcome-title">
    <div className="welcome-hero-copy"><p className="welcome-hook">Make, score and improve your thumbnail.</p>
     <h1 id="welcome-title" className="welcome-headline">No designer.<br/>No photoshoots.<br/><span>Less guesswork.</span></h1>
     <p className="welcome-lead">Create a thumbnail, review its five-pillar score, and choose what to improve. Your original stays saved.</p>
     <a className="welcome-primary" href="/studio">Start creating — bring your own API key <ArrowRight size={19}/></a>
     <p className="welcome-cost-inline">Your provider bills API usage directly. Scores are visual estimates, not measured click-through rates.</p>
    </div>
    <figure className="welcome-example"><img src="/styles/blueprint-1.webp" alt="Example thumbnail from the style library"/><figcaption>Style library example · illustrative score</figcaption>
     <div className="welcome-score"><div className="welcome-score-heading"><strong>61<small>/100</small></strong><span>Thumbnail score<br/><small>Five creative pillars</small></span></div>
      <dl>{[["Virality",64],["Clarity",57],["Idea",81],["Curiosity",62],["Emotion",63]].map(([name, score])=><div key={name}><dt>{name}</dt><dd>{score}</dd></div>)}</dl>
      <p><strong>Next: improve clarity</strong><br/>Review the suggested fix before generating a new version.</p>
     </div>
    </figure>
   </section>
   <section className="welcome-closing"><h2>Make it. Review it. Improve it.</h2><p>Bring an idea or an existing image into the studio. Review the score and keep control of the next step.</p><a className="welcome-primary" href="/studio">Open the studio <ArrowRight size={19}/></a>
    <details className="welcome-privacy"><summary>What is stored?</summary><div><p>Local drafts, reference images, personas and styles can be saved in this browser. With a cloud account, we store your account, conversations and prompts, creations and private images, personas, styles, analyses, feedback and job metadata.</p><p>Cloud connections store encrypted API keys and connection tokens so the server can use them for your requests. Saved keys are not returned to the interface. AI requests send the necessary inputs to your selected providers, whose terms and retention policies apply.</p></div></details>
   </section>
  </main><footer className="welcome-footer"><span>OpenPikzels · Built for the next great idea.</span><span>API and agent setup: <a href="/connect">Connections</a> · <a href="/local-companion">Local companion</a></span></footer>
 </div>;
}
