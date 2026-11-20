

export function Welcome() {
 return <div className="welcome">
  <a href="#welcome-main" className="welcome-skip">Skip to introduction</a>
  <header className="welcome-header"><a className="brand" href="/welcome">OpenPikzels<span className="wordmark-pixel" aria-hidden="true"/></a></header>
  <main id="welcome-main">
   <section className="welcome-hero" aria-labelledby="welcome-title">
    <div className="welcome-hero-copy">
     <h1 id="welcome-title" className="welcome-headline">No designer.<br/>No photoshoots.<br/><span>Less guesswork.</span></h1>
     <p className="welcome-lead">Make, score and fix your thumbnail.</p>
     <a className="welcome-primary" href="/studio">Start</a>
     <p className="welcome-cost-inline">You’ll need an AI key. We’ll help.</p>
    </div>
    <figure className="welcome-example"><img src="/styles/blueprint-1.webp" alt="Example thumbnail from the style library"/><figcaption>Example · illustrative score</figcaption>
     <div className="welcome-score"><div className="welcome-score-heading"><strong>61<small>/100</small></strong><span>Score</span></div>
      <dl>{[["Virality",64],["Clarity",57],["Idea",81],["Curiosity",62],["Emotion",63]].map(([name, score])=><div key={name}><dt>{name}</dt><dd>{score}</dd></div>)}</dl>
      <p><strong>Next: fix clarity</strong></p>
     </div>
    </figure>
   </section>
   <section className="welcome-closing">
    {/* copy-law: advanced */}<details className="welcome-privacy"><summary>What we store</summary><div><p>Local drafts, reference images, personas and styles can be saved in this browser. With a cloud account, we store your account, conversations and prompts, creations and private images, personas, styles, analyses, feedback and job metadata.</p><p>Cloud connections store encrypted API keys and connection tokens so the server can use them for your requests. Saved keys are not returned to the interface. AI requests send the necessary inputs to your selected providers, whose terms and retention policies apply.</p></div></details>{/* copy-law: end */}
   </section>
  </main></div>;
}
