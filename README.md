# WILDLANDS: After the Fall

A browser-playable top-down survival prototype built with Next.js and Canvas, ready for GitHub + Vercel.

## Included
- Pixel-art-style Canvas world with scrolling camera
- Deterministic terrain generation and chunk coordinate display
- WASD / arrow-key movement
- Gather trees, rocks and flowers with `E`
- Hunger, thirst and health prototype stats
- Eat berries with `F`
- Hotbar selection with keys `1`–`8`
- Stone axe, campfire and storage crate recipes
- Save/load in the current browser using localStorage

## Deploy with GitHub and Vercel
1. Create a new GitHub repository, for example `wildlands-after-the-fall`.
2. Upload the contents of this folder to the repository root (the `app` folder must be at the root).
3. Go to https://vercel.com and choose **Add New → Project**.
4. Import the GitHub repository.
5. Vercel should detect Next.js automatically. Click **Deploy**.
6. Future pushes to the connected GitHub branch trigger new deployments.

## Run locally
Install Node.js 20.9 or newer, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Current limitations
This is a playable frontend prototype, not a finished multiplayer game. Saves are stored only in the current browser. The generated scenery is placeholder Canvas art, and the sample house is decorative. It does not yet have user accounts, shared world state, server-authoritative inventory, real building placement, or online multiplayer.

For real persistent multiplayer, connect a database such as Neon Postgres and add server-side API routes that validate every inventory, crafting, and world-changing action. Do not treat localStorage as a secure source of game state.
