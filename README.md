# RISING

Not a tracker. You open it when your fire is fading (or when it's burning and you want to keep it that way), hold the ember, and it hands your own fire back to you: your myth, your people, your saga, and letters in your own voice from stronger days.

- Installable app: https://abrahambouchard24.github.io/rising/ (rebuilt and deployed by GitHub Actions on every push to `main`)
- claude.ai version: https://claude.ai/artifact/72H9pXhLuxfKv5JamfEX8j

## Files

- `rising.html` — the whole app, one file. Published to the claude.ai link as-is.
- `build.mjs` — wraps `rising.html` into an installable home-screen app in `app/` (manifest, icons, offline service worker).
- `app/` — generated; don't edit by hand.

## Two ways to run it

| | claude.ai link | Installable app (`app/`) |
|---|---|---|
| Myth, letters, saga | Synced to your Claude account | Saved on that device |
| Voice letters | Attach a voice memo file | Record in-app, or attach |
| Chapter cards (share as image) | Saved through claude.ai | Share sheet, or a download |
| Home-screen icon, works offline | No | Yes |

Voice clips are always stored on the device that recorded them.

## Build and try the installable app

```bash
node build.mjs
```

```bash
python -m http.server 8766 --directory app
```

Then open http://localhost:8766. To put it on your phone, host the `app/` folder anywhere with HTTPS (GitHub Pages, Netlify, Cloudflare Pages), open it on the phone, and choose **Add to Home Screen**.
