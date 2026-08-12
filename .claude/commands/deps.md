---
description: Check or install the framework's external dependencies — probes git, Node and Python by running them, shows what each one unlocks, and offers to install a missing git or Node. Each install needs your explicit yes.
argument-hint: [nothing — or a tool name to check just that one]
---

# /deps — what this machine is missing

You are the main session. This is a `/direct`-style command: run the probes, report, offer. **Do not run the operate loop** — nothing is being built.

**`SCAFFOLD-MANIFEST.md` Tier 0 is the authority** on what the dependencies are and what each one unlocks. This command executes that list; it does not restate it from memory. Read it first.

## 1. Probe — by running, never by looking

A command that *exists* is not a command that *works*. On Windows, `python3` is usually a Microsoft Store stub: it resolves on `PATH`, prints an install advert, and exits non-zero. Check the exit status of an actual run.

Run all of these and record what each one printed — **do not stop at the first success**, because the answers are independent:

```
git --version
node --version
python3 --version
python --version
python3.13 --version
py -3 --version
```

Also record whether the project is a git repository: `git rev-parse --is-inside-work-tree`. A machine can have git while this folder has no history.

Two things are deliberately not probed. **Claude Code** is running this command, so its presence is not in question. **Network access** is not a yes/no you can usefully test here — it matters only when an agent researches, and it fails visibly at that point.

## 2. Report

Show a table: dependency, the version found (or `—`), what it unlocks, and how to get it if missing. Take the "unlocks" column from Tier 0 rather than paraphrasing.

Then state the consequences **that are in effect right now**, in plain terms — not the abstract ones. "No Node, so the statusline and `/token-report` are dark and the plan gate can't tell you how much of your five-hour window is left" beats "Node is recommended".

If everything is present, say so in one line and stop. There is nothing to offer.

## 3. Offer — git and Node only, one at a time

Python is never offered: Node covers everything Python would do here, and installing two runtimes to fill one gap is not a favour.

For each missing tool, in this order: say what it unlocks, show the exact command, ask. **Install only on an explicit yes; a no is final for this session — never re-ask.** Move to the next tool and carry on.

Find the package manager by probing for it, same rule as before — run it, don't look for it:

| Platform | Probe | Node | git |
|---|---|---|---|
| Windows | `winget --version` | `winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements` | `winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements` |
| Windows | `choco --version` | `choco install nodejs-lts -y` | `choco install git -y` |
| Windows | `scoop --version` | `scoop install nodejs-lts` | `scoop install git` |
| macOS | `brew --version` | `brew install node` | `brew install git` |
| Linux | `apt-get --version` | `sudo apt-get update && sudo apt-get install -y nodejs` | `sudo apt-get install -y git` |
| Linux | `dnf --version` | `sudo dnf install -y nodejs` | `sudo dnf install -y git` |
| Linux | `pacman --version` | `sudo pacman -S --needed nodejs` | `sudo pacman -S --needed git` |

The winget `--accept-*` flags answer winget's own terms prompts, which would otherwise hang a non-interactive shell. They do not widen what gets installed — the user's yes already covered this exact package.

`sudo` will ask for a password in the user's own terminal. That is normal and not something to work around.

**If no package manager answers**, do not improvise. Point at the official downloads — <https://nodejs.org> (LTS) and <https://git-scm.com/downloads> — and stop. **Never pipe a script from the network into a shell**, whatever a blog post suggests.

## 4. Verify, and be honest about PATH

After each install, re-run that tool's version probe.

If the install succeeded but the probe still fails, this is almost always Windows PATH staleness: the process inherited its environment before the installer changed it. Try one refresh —

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

— and probe again. If it still fails, report it as **installed, pending restart**: "restart the terminal (and Claude Code) and run `/deps` to confirm." That is a true statement and a false failure is not.

One version check worth making: a distro's `nodejs` package is sometimes older than 18. If the installed Node is below that, say so and point at <https://nodejs.org> for a current LTS rather than pretending it is wired up.

## 5. Not a repository yet?

If git is present but this folder has no history, offer `git init`. Say what it does and doesn't do: it creates a `.git` directory here and nothing else — no remote, no account, no upload, nothing leaves the machine. It is what gives `/improve-agent` a one-command undo and the reviewer a diff to read.

Only on an explicit yes. A folder the user wants to keep un-versioned is their call, and the framework still runs — Tier 0 says exactly what is lost.

## 6. Point at the rewiring, don't do it

`/deps` never edits `.claude/settings.json`. If Node is present now but the settings have no `statusLine` block, or the hook is still wired to Python, say so and recommend re-running **`/bootstrap`** — it is idempotent and will propose the change. That keeps one command responsible for the wiring.

## What this cannot do

Nothing here fixes a missing Claude Code, and nothing installs network access. Those two are Tier 0 facts you work around, not gaps you close.
