# Tower Stack

An isometric, Roblox-style voxel stacking arcade game. Drop sliding blocks onto a growing tower, slice off whatever overhangs, and climb the leaderboard in one of three worlds.

- **Live:** https://towerstack-lilac.vercel.app (also served at https://towerstack.khaw.cc)
- **Stack:** one static `index.html` (HTML5 Canvas + CSS + vanilla JS, no frameworks, no image or audio files) plus one Vercel serverless function for the leaderboard.

---

## Table of contents

1. [Gameplay](#gameplay)
2. [Controls](#controls)
3. [Worlds](#worlds)
4. [Visual design](#visual-design)
5. [Audio](#audio)
6. [Leaderboard](#leaderboard)
7. [Project structure](#project-structure)
8. [Running locally](#running-locally)
9. [Hosting & configuration (Vercel)](#hosting--configuration-vercel)
10. [Deployment workflow](#deployment-workflow)
11. [Persistence (localStorage keys)](#persistence-localstorage-keys)
12. [Known limitations](#known-limitations)

---

## Gameplay

- A block slides back and forth above the tower, alternating between the **X** and **Z** axis each layer.
- **Tap / click / Space** to drop it. Only the part that overlaps the block below stays; the overhang is **sliced off** and becomes a 3D debris block that tumbles away with gravity and rotation.
- **Perfect snap:** if the alignment error is within the world's tolerance (2 px on Medium), the block snaps to zero error, a chime plays, sparkles burst, and a floating **"Perfect!"** badge appears.
- **Combo:** from the 3rd consecutive perfect snap onward, the block grows back out by a world-specific amount (12 px on Medium), capped at the world's original block size. Any non-perfect drop resets the combo.
- **Speed** scales with height: every layer adds a world-specific percentage to the base speed (2% on Medium).
- **Game over:** a complete miss (zero overlap) triggers a tower-collapse animation, then the Game Over sheet slides up with your score and personal best.
- **Score** = number of layers successfully stacked (the base block is not counted).
- **Colours** cycle through a five-colour palette; the hue blends into the next palette over the last layers of each 10-layer band, so the tower and background shift colour every 10 layers.
- The **camera** follows the top of the tower with smooth exponential easing.

## Controls

| Action | Input |
| --- | --- |
| Drop block | Tap / click anywhere, `Space`, or `Enter` |
| Start / replay | `Space`, `Enter`, or the on-screen button |
| Pause / resume | Pause button, `P`, or `Esc` |
| Restart | Restart button or `R` |
| Mute / unmute | Speaker button (top right) or `M` |
| Close leaderboard | Close button or `Esc` |

The game auto-pauses when the tab loses focus or visibility.

## Worlds

Pick a world on the start screen (the choice is remembered). Each world has its own difficulty, palette, personal best and leaderboard.

| World | Difficulty | Block size | Start speed | Speed gain / layer | Snap tolerance | Combo regrowth | Slide range | Palette |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Sunny Meadow** | Easy | 220 | 165 px/s | +1.2% | 4 px | +16 px | ±230 | green → cyan → yellow → lime → blue |
| **Neon City** | Medium | 200 | 230 px/s | +2% | 2 px | +12 px | ±250 | red → cyan → yellow → lime → purple |
| **Volcano Peak** | Hard | 170 | 300 px/s | +3% | 2 px | +8 px | ±270 | red-orange → orange → yellow → magenta → purple |

Worlds are defined in the `WORLDS` object near the top of the script in `index.html`. You can deep-link a world with `?world=easy|medium|hard`.

## Visual design

- **Apple HIG-style UI:** system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", …`), frosted-glass cards and HUD (`rgba(255,255,255,.75)` + `backdrop-filter: blur(20px)`, 1 px white border, layered soft shadows), pill buttons with spring easing and `scale(.96)` pressed state, a segmented control for worlds, bottom sheet for Game Over, automatic dark mode, safe-area insets for notched phones, and `prefers-reduced-motion` support.
- **Roblox-style voxel blocks:** rendered in true isometric projection with three lit faces (bright top, medium left, dark right) using per-face gradients and dark outlines, plus LEGO/Roblox-style **studs** on exposed top faces and a studded baseplate.
- **Debris** is rendered as real rotated 3D boxes (Euler rotation, back-face culling, per-face lighting from the rotated normal).

## Audio

All sound is synthesised at runtime with the **Web Audio API** (no audio files):

- soft mechanical **click** when the block reverses direction and as it slides
- rising **C-major scale** note for each stacked layer (wraps after ~3 octaves)
- bell-like **chime** arpeggio on perfect snaps (longer with higher combo)
- crisp **chop** (filtered noise + pitch drop) on slice
- playful bouncing **tumble** for falling debris
- low **rumble** and a descending phrase on collapse / game over

The **mute button** (top right, or `M`) silences everything instantly; the setting is saved. The audio context is created on the first user gesture, as browsers require.

## Leaderboard

Each world has its own top-10 board, reachable from the start screen and the Game Over sheet. After a game you can enter a name and **Submit**; the board opens with your row highlighted and your rank shown. One best score is kept per name per world (names are case-insensitive; submitting a lower score is ignored).

### Name rules and profanity filter

Implemented server-side in `api/_profanity.js` (the client cannot bypass it):

- 2–14 characters; letters, numbers, spaces, `_`, `-`, `.` only.
- Leetspeak is normalised (`sh1t`, `a55`), repeated letters are tolerated (`fuuuck`), and spaced-out letters are caught (`f u c k`).
- Long, unambiguous words are matched as substrings; short or ambiguous words (e.g. `ass`, `dick`, `sex`) only as whole words, so names like *Essex*, *Dickson* and *peacock* are fine.
- An allow-list handles the "Scunthorpe problem" (e.g. *Scunthorpe*, *Shiitake*, *Cassandra*).
- Rejected names return `400 {"error":"name_rejected"}` and the UI asks for a different name.

### API

`/api/scores` (`api/scores.js`, Node serverless function):

| Method | Request | Response |
| --- | --- | --- |
| `GET` | `/api/scores?world=easy\|medium\|hard` | `200 {"world","entries":[{"name","score"}…]}` (top 10, cached 5 s at the edge) |
| `POST` | JSON `{"world","name","score"}` | `200 {"ok","improved","name","score","rank","entries"}` |

Errors: `invalid_world`, `invalid_score` (integer 1–2000), `invalid_name`, `name_rejected` (all `400`), `method_not_allowed` (`405`), `server_error` (`500`).

### Storage design

Scores live in a **Vercel Blob** store. Each entry is one tiny object:

```
lb/<world>/<999999 − score, 6 digits>-<timestamp>-<base64url(name)>.json
```

Because Blob listings are lexicographic, the highest scores sort first and the name is read straight from the path, so a leaderboard read is a single `list` call with no per-entry fetches. When a player beats their own score the old object is deleted, so there is at most one object per player per world. The API reads a window of the top 300 objects.

## Project structure

```
.
├── index.html          # the whole game: markup, CSS, canvas renderer, audio, UI logic
├── api/
│   ├── scores.js       # GET/POST leaderboard endpoint (Vercel Blob)
│   └── _profanity.js   # name validation + profanity filter (not exposed as a route)
├── package.json        # "type": "module"; depends on @vercel/blob
├── package-lock.json
├── vercel.json         # Git deployment rules + clean URLs
├── .gitignore
└── README.md
```

## Running locally

The game itself needs no build step: open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Without the API, the game plays normally; the leaderboard shows "Couldn't load the leaderboard" and submitting fails gracefully.

To run the API too, use the Vercel CLI against the linked project so the Blob token is available:

```bash
npm install
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

## Hosting & configuration (Vercel)

| Setting | Value |
| --- | --- |
| Team | `cckhaw-5201` (`team_FdOJU6k0aSSHE2P7hHTWrNuP`) |
| Project | `towerstack` (`prj_XLHkAElZ7iPOYpklJE2A3cyFDQJC`) |
| Framework | none (static `index.html` + `/api` functions) |
| Production domains | `towerstack-lilac.vercel.app`, `towerstack.khaw.cc` |
| Git integration | `cckhaw/towerstack`, production branch `main` |
| Vercel Authentication | **Disabled**; the site and API are public |
| Blob store | `towerstack-leaderboard` (`store_omXtkYR5F1t0Py1T`), public access, region `iad1` |
| Environment variable | `BLOB_READ_WRITE_TOKEN` (production, preview, development), injected automatically when the store was linked to the project. It is read by `@vercel/blob`; never commit it. |

### `vercel.json`

```json
{
  "git": {
    "deploymentEnabled": { "main": true, "claude/*": false, "claude/bold-davinci-vtermb": false }
  },
  "cleanUrls": true
}
```

Only pushes to `main` trigger Git deployments; feature branches (including `claude/*`) do **not** build preview deployments.

### CI / deployment credentials

The Vercel team ID, project ID and token are stored as GitHub secrets and as environment variables in the Claude Code cloud environment (`VERCEL_TEAM_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`). They are not stored in the repository.

## Deployment workflow

This project deploys **production only**: no preview deployments.

1. Develop on a feature branch and open a pull request into `main` (no preview build is created).
2. Merging to `main` triggers a **Production** deployment through the Git integration. Alternatively, deploy directly from a checkout:
   ```bash
   npx vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_TEAM_ID"
   ```
3. Once the new production deployment is **READY**, delete every older deployment so only the latest remains:
   ```bash
   npx vercel remove <old-deployment-id-or-url> --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_TEAM_ID"
   ```
4. Smoke-test: load the site, then `curl "https://towerstack-lilac.vercel.app/api/scores?world=easy"`.

## Persistence (localStorage keys)

| Key | Purpose |
| --- | --- |
| `towerstack.best.easy` / `.medium` / `.hard` | personal best per world |
| `towerstack.best` | legacy pre-worlds best, migrated to Medium |
| `towerstack.world` | last selected world |
| `towerstack.name` | last leaderboard name |
| `towerstack.muted` | mute setting (`1` / `0`) |

All access is wrapped in `try/catch`, so the game still works when storage is blocked.

## Known limitations

- **Scores are client-reported.** The server only checks that a score is an integer from 1 to 2000, so a determined cheater can post a fake score. Stronger protection would need server-side replay validation or signed game sessions.
- **The profanity filter is a word list.** It is best-effort: creative spellings can slip through, and it only covers English.
- No rate limiting on the leaderboard endpoint; the 2–14 character name limit and one-entry-per-name rule bound storage growth, but a script could still create many distinct names.
- The 2 px perfect window becomes very tight at high speeds, especially on Hard.
