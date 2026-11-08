# OpenPikzels local companion
This is a source companion for macOS and Linux, not a signed native installer.
It requires Node.js 22+ and an installed, current official Claude Code or Codex CLI.
It runs only on your computer at http://127.0.0.1:48763.

1. Install Node.js from https://nodejs.org/en/download if it is missing.
2. Install your selected official CLI using https://code.claude.com/docs/en/setup or https://learn.chatgpt.com/docs/cli.
3. Extract the download. On macOS, open Start OpenPikzels.command. On Linux, run ./start-linux.sh.
4. The browser opens the companion. You do not need to read its server terminal.
5. Click the official sign-in button. Complete the provider's own browser/terminal flow. Return and click Refresh sign-in status.
6. Choose titles, concepts or an edit prompt. Enter your factual brief. Click Run this text task.

The official binary owns its login and credential storage. This companion never opens auth files, accepts OAuth tokens or sends those credentials to OpenPikzels/Vercel. CLI status is reduced to an authentication method without an email or token.
Every task uses the active CLI authentication. Subscription sign-in uses the provider's plan limits; an API-key login uses API credits. No shared account is provided.
No model task runs until you click Run. Tasks have cancellation and a 120-second timeout; uncertain provider usage must be checked before retrying.
The companion only makes text. It does not generate an image, inspect an attached image or provide a visual score. Use your studio's API connections for those operations.
No prompt history or model output is stored by the companion. The official CLI and provider retain data under their own settings and terms.
This package adds no startup service, does not install/modify a CLI, and does not disable the CLI's own authentication choices.
Close its server terminal to stop the companion. Windows launch/sign-in packaging is not included in this version.

User custom hooks are disabled for text runs. Provider-managed organizational policies still apply and cannot be overridden by this companion.

The launcher hands an ephemeral local access capability to its browser tab. It is separate from provider credentials, stays in that tab, and is cleared when the tab session ends. Opening the bare loopback page grants no execution access. Keep the launcher tab for this local session.
