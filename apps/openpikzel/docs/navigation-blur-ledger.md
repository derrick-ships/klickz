# Navigation blur release ledger
Baseline8622ead. Actual five attachments inspected; customer screenshots remain private references, standalone OpenAI/Google PNGs copied exactly and rendered white with CSS.
Initial new4 browser checks:3 failed (flat dark scrim, voice present, missing picker),1 compatibility check passed. New4 then green.
Fresh Astra low/fast review: no Critical, one Important (selected model hidden from AT). Accessible-description regression observed failing; fixed shared trigger via aria-describedby/current visible name, covering composer/sidebar selection and focus return.
Full-suite first pass:48 passed,1 old constant-duration assertion failed (220ms versus intended200ms). Replaced constant detector with nonzero<=300ms pointer-motion bound; keyboard/reduced-motion checks retained.
No backend, credential, dependency or schema changes; no paid provider calls.
WebKit engine validation reproduced Safari-style pointer focus behavior: clicking a model trigger does not focus it by default, so native dialog restoration lacked the opener. Explicitly focus the activated trigger before opening; regression is the same cross-browser focus-return check.
