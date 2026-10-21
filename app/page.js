"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TILE = 32;
const CHUNK = 32;
const SAVE_KEY = "wildlands-save-v1";
const ITEMS = {
  wood: { name: "Wood", icon: "🪵", max: 99 },
  stone: { name: "Stone", icon: "🪨", max: 99 },
  berries: { name: "Berries", icon: "🫐", max: 20 },
  axe: { name: "Stone axe", icon: "🪓", max: 1 },
  campfire: { name: "Campfire", icon: "🔥", max: 10 },
  crate: { name: "Storage crate", icon: "📦", max: 10 }
};

function hash(x, y, seed = 17) {
  let n = Math.imul(x ^ seed, 374761393) + Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function tileAt(tx, ty) {
  const h = hash(tx, ty);
  const nearPath = Math.abs(Math.sin(ty * 0.13) * 7 + (tx % 23)) < 1.25;
  if (nearPath) return "path";
  if (h > 0.965) return "flower";
  if (h > 0.925) return "rock";
  if (h > 0.79) return "tree";
  if (h > 0.745) return "grass";
  return "ground";
}
function keyFor(tx, ty) { return `${tx},${ty}`; }
function initialGame() {
  return {
    player: { x: 0, y: 0, health: 100, hunger: 100, thirst: 100 },
    inventory: { wood: 0, stone: 0, berries: 3, axe: 0, campfire: 0, crate: 0 },
    harvested: {},
    placed: {},
    selected: 0,
    day: 1
  };
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function Home() {
  const canvasRef = useRef(null);
  const gameRef = useRef(initialGame());
  const keysRef = useRef({});
  const [stats, setStats] = useState(initialGame());
  const [message, setMessage] = useState("Welcome to the wilderness. Find resources and survive.");
  const [nearby, setNearby] = useState("Explore the forest.");
  const [name, setName] = useState("Survivor");
  const [ready, setReady] = useState(false);
  const nearbyRef = useRef("");

  const updateUI = useCallback((msg) => {
    const copy = structuredClone(gameRef.current);
    setStats(copy);
    if (msg) setMessage(msg);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        gameRef.current = { ...initialGame(), ...parsed, player: { ...initialGame().player, ...(parsed.player || {}) }, inventory: { ...initialGame().inventory, ...(parsed.inventory || {}) } };
        setStats(structuredClone(gameRef.current));
        setMessage("Save loaded from this browser.");
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    const down = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
      keysRef.current[e.key.toLowerCase()] = true;
      if (/^[1-8]$/.test(e.key)) {
        gameRef.current.selected = Number(e.key) - 1;
        updateUI();
      }
      if (e.key.toLowerCase() === "e") interact();
      if (e.key.toLowerCase() === "f") eatBerry();
    };
    const up = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [updateUI]);

  const interact = useCallback(() => {
    const g = gameRef.current;
    const tx = Math.round(g.player.x / TILE), ty = Math.round(g.player.y / TILE);
    let target = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, y = ty + dy, k = keyFor(x,y);
      if (g.harvested[k]) continue;
      const type = tileAt(x,y);
      if (type === "tree" || type === "rock" || type === "flower") {
        target = { x, y, type, k }; break;
      }
    }
    if (!target) { updateUI("Nothing nearby to gather. Look for trees, rocks, or flowers."); return; }
    g.harvested[target.k] = true;
    if (target.type === "tree") {
      g.inventory.wood = Math.min(99, g.inventory.wood + (g.inventory.axe ? 4 : 2));
      updateUI(`Gathered ${g.inventory.axe ? 4 : 2} wood.`);
    } else if (target.type === "rock") {
      g.inventory.stone = Math.min(99, g.inventory.stone + 2);
      updateUI("Collected 2 stone.");
    } else {
      g.inventory.berries = Math.min(20, g.inventory.berries + 2);
      updateUI("Picked 2 handfuls of berries.");
    }
  }, [updateUI]);

  const eatBerry = useCallback(() => {
    const g = gameRef.current;
    if (g.inventory.berries < 1) { updateUI("You have no berries to eat."); return; }
    g.inventory.berries--;
    g.player.hunger = clamp(g.player.hunger + 18, 0, 100);
    updateUI("You ate berries. Hunger restored.");
  }, [updateUI]);

  const craft = useCallback((item) => {
    const g = gameRef.current, inv = g.inventory;
    if (item === "axe") {
      if (inv.axe) { updateUI("You already have a stone axe."); return; }
      if (inv.wood < 3 || inv.stone < 2) { updateUI("Stone axe needs 3 wood and 2 stone."); return; }
      inv.wood -= 3; inv.stone -= 2; inv.axe = 1; updateUI("Crafted a stone axe. Trees now yield more wood.");
    } else if (item === "campfire") {
      if (inv.wood < 6 || inv.stone < 3) { updateUI("Campfire needs 6 wood and 3 stone."); return; }
      inv.wood -= 6; inv.stone -= 3; inv.campfire++; updateUI("Crafted a campfire (prototype item).");
    } else if (item === "crate") {
      if (inv.wood < 8 || inv.stone < 2) { updateUI("Storage crate needs 8 wood and 2 stone."); return; }
      inv.wood -= 8; inv.stone -= 2; inv.crate++; updateUI("Crafted a storage crate (prototype item).");
    }
  }, [updateUI]);

  const save = useCallback(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameRef.current));
      updateUI("Game saved in this browser.");
    } catch { updateUI("Could not save in this browser."); }
  }, [updateUI]);

  const load = useCallback(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) { updateUI("No browser save found yet."); return; }
      gameRef.current = { ...initialGame(), ...JSON.parse(saved) };
      updateUI("Save loaded.");
    } catch { updateUI("Save could not be loaded."); }
  }, [updateUI]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d");
    let frame = 0, last = 0, hungerTimer = 0;
    const draw = (timestamp) => {
      const g = gameRef.current;
      const dt = Math.min((timestamp - (last || timestamp)) / 1000, 0.04); last = timestamp;
      const keys = keysRef.current;
      let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      if (dx || dy) {
        const len = Math.hypot(dx,dy) || 1;
        g.player.x += (dx / len) * 115 * dt;
        g.player.y += (dy / len) * 115 * dt;
      }
      hungerTimer += dt;
      if (hungerTimer > 12) {
        hungerTimer = 0;
        g.player.hunger = Math.max(0, g.player.hunger - 1);
        g.player.thirst = Math.max(0, g.player.thirst - 2);
        if (g.player.hunger === 0 || g.player.thirst === 0) g.player.health = Math.max(0, g.player.health - 2);
        setStats(structuredClone(g));
      }

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);
      const camX = g.player.x - w / 2, camY = g.player.y - h / 2;
      const startX = Math.floor(camX / TILE) - 1, endX = Math.ceil((camX + w) / TILE) + 1;
      const startY = Math.floor(camY / TILE) - 1, endY = Math.ceil((camY + h) / TILE) + 1;

      for (let ty = startY; ty <= endY; ty++) for (let tx = startX; tx <= endX; tx++) {
        const px = tx*TILE-camX, py=ty*TILE-camY, k=keyFor(tx,ty);
        const type = g.harvested[k] ? "ground" : tileAt(tx,ty);
        const variation = hash(tx+4,ty-9);
        ctx.fillStyle = type === "path" ? (variation>.5?"#8c7956":"#978363") : type === "ground" ? (variation>.5?"#617f49":"#68864e") : "#68864e";
        ctx.fillRect(px,py,TILE,TILE);
        // Pixel-art ground speckles
        ctx.fillStyle = type === "path" ? "#b2a078" : "#789958";
        if (variation > .25) ctx.fillRect(px+4+(variation*15|0),py+6,2,2);
        if (type === "grass" || type === "flower") {
          ctx.fillStyle = "#3e6638";
          ctx.fillRect(px+7,py+13,3,7); ctx.fillRect(px+15,py+9,2,8);
          if(type==="flower"){ctx.fillStyle=variation>.5?"#d7b7e8":"#e4d07a";ctx.fillRect(px+16,py+8,4,4);}
        }
        if (type === "tree") {
          ctx.fillStyle = "#4b3829"; ctx.fillRect(px+13,py+14,8,15);
          ctx.fillStyle = "#315b36"; ctx.fillRect(px+3,py+3,25,20);
          ctx.fillStyle = "#477b43"; ctx.fillRect(px+1,py+7,15,15);
          ctx.fillStyle = "#5c8b4b"; ctx.fillRect(px+9,py+2,13,12);
          ctx.fillStyle = "#6b9854"; ctx.fillRect(px+8,py+6,5,4);
        }
        if (type === "rock") {
          ctx.fillStyle="#7c8580";ctx.fillRect(px+7,py+13,17,12);
          ctx.fillStyle="#aeb5ad";ctx.fillRect(px+11,py+10,9,7);
          ctx.fillStyle="#5d655f";ctx.fillRect(px+8,py+22,16,3);
        }
        // Chunk boundaries subtly show the chunk-based system
        if (tx % CHUNK === 0) { ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(px,py,1,h); }
        if (ty % CHUNK === 0) { ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(px,py,w,1); }
      }

      // A small ruined house set near the starting area
      const houseX = 110-camX, houseY = -140-camY;
      ctx.fillStyle="#2e332d";ctx.fillRect(houseX,houseY,260,175);
      ctx.fillStyle="#b5a98c";ctx.fillRect(houseX+7,houseY+7,246,161);
      ctx.fillStyle="#8d8776";ctx.fillRect(houseX+7,houseY+7,246,161);
      // wood floor
      for(let yy=houseY+8;yy<houseY+165;yy+=16){ctx.fillStyle="#9b886b";ctx.fillRect(houseX+8,yy,244,14);ctx.fillStyle="#78674f";ctx.fillRect(houseX+8,yy+14,244,2);}
      // kitchen tiled zone
      ctx.fillStyle="#68736d";ctx.fillRect(houseX+8,houseY+8,112,60);
      for(let xx=houseX+8;xx<houseX+120;xx+=16)for(let yy=houseY+8;yy<houseY+68;yy+=16){ctx.strokeStyle="#a6b0a7";ctx.strokeRect(xx,yy,16,16);}
      // furniture
      ctx.fillStyle="#e4e0d1";ctx.fillRect(houseX+20,houseY+18,24,18);
      ctx.fillStyle="#58625b";ctx.fillRect(houseX+50,houseY+16,30,23);
      ctx.fillStyle="#594234";ctx.fillRect(houseX+140,houseY+18,32,42);
      ctx.fillStyle="#b6b7a9";ctx.fillRect(houseX+190,houseY+15,45,20);
      ctx.fillStyle="#9e5930";ctx.fillRect(houseX+35,houseY+95,35,27);
      ctx.fillStyle="#ddd4bd";ctx.fillRect(houseX+75,houseY+100,46,30);
      ctx.fillStyle="#6c756d";ctx.fillRect(houseX+180,houseY+100,55,28);
      // open front doorway
      ctx.fillStyle="#68864e";ctx.fillRect(houseX+118,houseY+161,32,8);
      // player shadow + pixel character
      const px = w/2, py=h/2;
      ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(px-9,py+9,19,5);
      ctx.fillStyle="#d6b99b";ctx.fillRect(px-5,py-12,10,10);
      ctx.fillStyle="#6e4934";ctx.fillRect(px-6,py-15,12,5);
      ctx.fillStyle="#c7d2b0";ctx.fillRect(px-7,py-2,14,12);
      ctx.fillStyle="#4b5948";ctx.fillRect(px-7,py+9,5,7);ctx.fillRect(px+2,py+9,5,7);
      ctx.fillStyle="#e8e4d2";ctx.fillRect(px-8,py+1,3,7);ctx.fillRect(px+5,py+1,3,7);

      const worldTileX=Math.floor(g.player.x/TILE), worldTileY=Math.floor(g.player.y/TILE);
      const chunkX=Math.floor(worldTileX/CHUNK), chunkY=Math.floor(worldTileY/CHUNK);
      document.getElementById("coords").textContent=`Tile ${worldTileX}, ${worldTileY} · Chunk ${chunkX}, ${chunkY}`;
      const nearTypes=[];
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){const t=tileAt(worldTileX+xx,worldTileY+yy);if(t==="tree"||t==="rock"||t==="flower")nearTypes.push(t);}
      const nearbyText = nearTypes.length ? `Nearby: ${[...new Set(nearTypes)].join(", ")}. Press E to gather.` : "Nothing to gather close by.";
      if (nearbyRef.current !== nearbyText) { nearbyRef.current = nearbyText; setNearby(nearbyText); }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const slots = ["axe","wood","stone","berries","campfire","crate","",""];
  const inv = stats.inventory || {};
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-icon">W</div><div><strong>WILDLANDS</strong><small>AFTER THE FALL</small></div></div>
        <div className="vitals">
          <div className="vital"><span>❤</span><div><small>HEALTH</small><b>{stats.player.health}</b></div><i><em style={{width:`${stats.player.health}%`}} /></i></div>
          <div className="vital"><span>🍗</span><div><small>HUNGER</small><b>{stats.player.hunger}</b></div><i><em style={{width:`${stats.player.hunger}%`}} /></i></div>
          <div className="vital"><span>💧</span><div><small>THIRST</small><b>{stats.player.thirst}</b></div><i><em style={{width:`${stats.player.thirst}%`}} /></i></div>
        </div>
        <div className="online"><span className="dot"></span> SOLO PROTOTYPE</div>
      </header>

      <div className="main-grid">
        <section className="game-column">
          <div className="canvas-frame">
            <canvas ref={canvasRef} width="960" height="600" aria-label="Wildlands game world" />
            <div className="world-label"><span>FIELD NOTES</span><b>THE GREENBELT</b><small>DAY {stats.day || 1} · UNCHARTED TERRITORY</small></div>
            <div className="interaction-hint"><kbd>W A S D</kbd> MOVE <span>·</span> <kbd>E</kbd> GATHER <span>·</span> <kbd>F</kbd> EAT BERRIES</div>
            <div className="toast" aria-live="polite">{message}</div>
          </div>
          <div className="hotbar">
            {slots.map((item,i)=><button key={i} className={`slot ${stats.selected===i?"selected":""}`} onClick={()=>{gameRef.current.selected=i;updateUI();}} title={item?ITEMS[item]?.name:"Empty slot"}>
              <span className="slot-num">{i+1}</span><span className="slot-icon">{item && ITEMS[item] ? ITEMS[item].icon : ""}</span>
              {item && inv[item]>0 && <span className="slot-count">{inv[item]}</span>}
            </button>)}
          </div>
          <p className="small-note">Prototype art is drawn in Canvas. Replace the placeholder tiles with a consistent pixel-art tileset as development continues.</p>
        </section>

        <aside className="sidebar">
          <section className="card">
            <div className="card-heading"><span className="eyebrow">YOUR JOURNEY</span><span className="badge">ALPHA 0.1</span></div>
            <label className="field-label">SURVIVOR NAME<input value={name} maxLength={18} onChange={e=>setName(e.target.value)} /></label>
            <div className="button-pair"><button onClick={save}>Save game</button><button className="button-muted" onClick={load}>Load</button></div>
            <p className="muted">Saves are stored in this browser only. They are not shared between devices yet.</p>
          </section>

          <section className="card">
            <div className="card-heading"><span className="eyebrow">FIELD REPORT</span><span className="report-mark">⌖</span></div>
            <p className="nearby">{nearby}</p>
            <button className="full-button" onClick={interact}>Search / gather <span>E ↗</span></button>
            <button className="full-button secondary-action" onClick={eatBerry}>Eat berries <span>F ↗</span></button>
          </section>

          <section className="card">
            <div className="card-heading"><span className="eyebrow">BACKPACK</span><span className="muted">RESOURCES</span></div>
            <div className="resource-grid">
              {["wood","stone","berries","axe","campfire","crate"].map(id=><div className="resource" key={id}><span className="resource-icon">{ITEMS[id].icon}</span><span className="resource-name">{ITEMS[id].name}</span><b>{inv[id]||0}</b></div>)}
            </div>
          </section>

          <section className="card">
            <div className="card-heading"><span className="eyebrow">FIELD CRAFTING</span><span className="muted">RECIPES</span></div>
            <div className="recipe"><div><b>Stone axe</b><small>3 wood · 2 stone</small></div><button onClick={()=>craft("axe")}>Craft</button></div>
            <div className="recipe"><div><b>Campfire</b><small>6 wood · 3 stone</small></div><button onClick={()=>craft("campfire")}>Craft</button></div>
            <div className="recipe"><div><b>Storage crate</b><small>8 wood · 2 stone</small></div><button onClick={()=>craft("crate")}>Craft</button></div>
          </section>
          <section className="card objective-card">
            <span className="eyebrow">CURRENT OBJECTIVE</span>
            <h3>Make it through the day.</h3>
            <p>Collect wood and stone. Craft a tool. Keep your hunger and thirst above zero.</p>
            <div className="objective-line"><span>Gather 5 wood</span><b>{Math.min(5,inv.wood||0)}/5</b></div><div className="progress"><span style={{width:`${Math.min(100,(inv.wood||0)*20)}%`}}/></div>
          </section>
        </aside>
      </div>
      <footer><span>WILDLANDS / AFTER THE FALL</span><span>GITHUB SOURCE · VERCEL DEPLOYMENT READY</span></footer>
    </main>
  );
}
