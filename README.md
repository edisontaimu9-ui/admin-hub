# Admin Hub

A small installable PWA that lists all of my admin panels in one place.

- Add, edit, delete and search panels (name, link, optional group and note)
- Saved on the device (localStorage); export and import a JSON backup to move between phones
- Works offline once installed; opens each panel in the browser
- Stores links only, never passwords or tokens. Each panel keeps its own login.

## Run locally

    npm install
    npm run dev

## Build

    npm run build

## Deploy (Cloudflare Pages)

Build command: `npm run build`  Output directory: `dist`
