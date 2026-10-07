# Betterwright Windows background processes

Local fix tested against Betterwright 2.8.7 (MIT). The installed daemon and browser worker spawn options need windowsHide: true; preserve detached, stdio, cwd, env and all existing arguments. A compiled betterwright.exe embeds its own code, so source patches require launching the existing Bun executable with the installed package dist/bin/betterwright.js. The three launcher examples preserve arguments, stdin and exit status. Adapt absolute paths to your own installation; do not replace them blindly.

Apply only to matching installed source; back up daemon-client.js, client.js and all replaced shims first. Insert windowsHide: true into the spawn(process.execPath, ...) options in dist/src/daemon-client.js and dist/src/client.js. No dependency installation or rebuild is needed. Package updates can overwrite these fixes. Retest after an update, or remove the workaround once upstream provides the same behavior.

A daemon may remain alive to serve persistent sessions; hiding its console does not terminate it. Close only the intended test/session with Betterwright close. Browser UI remains visible when requested. This directory does not vendor the dependency; LICENSE retains upstream attribution for the small source modification.

Absolute calls to .bun/bin/betterwright.exe bypass these source patches. Use the patched runtime launchers. The PowerShell launcher explicitly forwards pipeline input and returns the child exit code.
