# backend

**The app does not need this.** `frontend/` is a static site: it renders and
encodes video in the browser, with no server, no upload and no API key.

This folder holds a zero-dependency Node static host, for two cases:

1. **Testing on your phone over your own Wi-Fi.**
   ```sh
   node backend/server.js
   # then open http://<your-computer-ip>:8080 on the phone
   ```
2. **Self-hosting** on any free Node tier.

```sh
PORT=3000 HOST=127.0.0.1 node backend/server.js
```

## A note on HTTPS

`VideoEncoder` (WebCodecs) is only exposed in a **secure context**. That means
`https://` or `http://localhost`. A plain `http://192.168.1.x` LAN address is
*not* a secure context, so the app will quietly fall back to the
MediaRecorder encoder — still an MP4 on Chrome, just recorded in real time.

To get the hardware H.264 path on a phone, serve the `frontend/` folder from
any HTTPS host. GitHub Pages, Netlify, Cloudflare Pages and Vercel all host
it free, and none of them need a build step — the folder is the site.
