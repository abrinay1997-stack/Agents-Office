// Agents Office — the ESTUDIO: images and video the agents (and the owner) generate for real.
//
// ENGINES. One is ON when its key is in the Windows environment (set it once: `setx NAME "…"`, then restart the office);
// no key ever lives in a file of this repo:
//   higgsfield — Higgsfield Cloud: Soul, Kling 3, Seedance 2/2.5, Flux 2, Ideogram 4, Recraft, Wan, MiniMax, LTX…  HF_KEY="id:secret"
//                (or HF_API_KEY + HF_API_SECRET; HF_API_BASE_URL overrides https://api.higgsfield.ai)
//   gemini     — Google: Nano Banana 2 / 2 Lite / Pro (images), Veo 3.1 / Fast / Lite (video)  GEMINI_API_KEY
//   grok       — xAI Grok image                                                     XAI_API_KEY
//   openai     — OpenAI gpt-image-1                                                 OPENAI_API_KEY
//   meta       — Meta Muse Image (muse-image-1.0): generates, edits, searches real references itself   META_API_KEY (or MODEL_API_KEY)
//   fal        — fal.ai: Flux, Seedream, Nano Banana, Ideogram, Kling, Seedance, Hailuo, Veo   FAL_KEY
//   minimax    — MiniMax direct (V4.10): image-01, video MiniMax-H3/H3-Max, VOICE (speech-2.8/2.6) and MUSIC (music-3.0), one key   MINIMAX_API_KEY
//                (minimax.mjs is the client; the owner's cloned and designed voices live in minimax-voices.mjs)
//   prueba     — a free local test card: the whole pipeline without spending anything
// MODELS. CATALOG below: each model says its engine, the media it takes (start/end frame, references, a video) and its
// settings. The Higgsfield entries and their request bodies follow open-higgsfield (wide-trace/open-higgsfield,
// src/generation/to-platform.ts and catalog/), the auth and the upload follow Higgsfield's own client (higgsfield-client).
// JOBS. Every generation is a job in data/media-jobs.json that runs in the background: nobody waits on a video. The queue
// engines (Higgsfield, fal video) keep their request ids in the job, so a restart of the office resumes the poll.
// FILES. <brain>/Agents Office/media/YYYY-MM/<name>.<ext> with <name>.json beside it (prompt, model, settings, the media
// it used, cost estimate, who asked, task). Budget: office.config.json → "media": { "dailyLimit": 40, "maxPerRequest": 8 }.
// V4.5 (27 Sep 2026): the owner sets it in Ajustes → Estudio (office.config.local.json, applied at once by setLimits): the
// count a day (0 = no cap) and, new, a spend limit in US$ a day and a month ("dailyBudget", "monthlyBudget"; 0 = none),
// checked BEFORE a request is sent with the model's estimated price, counting what is still being generated.
//
// F0 del banco de presets (1 oct 2026): este archivo es ahora una FACHADA. El código vive en media/ y aquí solo se junta,
// con la misma API de siempre (nadie cambia sus import; tests/media-fachada.test.mjs lo comprueba contra una foto del
// media.mjs de antes de partirlo):
//   media/catalogo.mjs  motores y keys, CATALOG, EDIT_MODELS, PREFER, INFO, settingsFor, unitCost, estimate y capsOf
//   media/galeria.mjs   archivos y fichas, carpetas, índice en memoria, query(), papelera, subidas, zip
//   media/motores.mjs   hablar con cada servicio (RUN) y los errores en palabras
//   media/trabajos.mjs  presupuesto, la cola de trabajos, editar, el rastro en el Cerebro y en la memoria
//   media/estado.mjs    la configuración que todos leen (S.cfg)
// Lo nuevo va en su módulo y, si otro archivo lo necesita, se reexporta aquí.
import path from 'node:path';
import { S } from './media/estado.mjs';
import { DEFAULT_MODELS, setCustom } from './media/catalogo.mjs';
import { setRoot, startIndex } from './media/galeria.mjs';
import { setFiles, loadJobs } from './media/trabajos.mjs';

export { ENGINES, NAMES, DEFAULT_MODELS, KINDS, TIER_NAME, hfSchemas, hfRoute, hfBody, model, models, editModels, engines, providers, defaultModel, defaultProvider, estimate, capsOf } from './media/catalogo.mjs';
export { dir, folders, folderOf, addFolder, renameFolder, removeFolder, moveTo, ready, list, PAGE_MAX, query, resolve, item, update, trash, restore, BIN_DAYS, trashList, trashFile, purge, upload, zip, markUsed, wasUsed } from './media/galeria.mjs';
export { veoRequest } from './media/motores.mjs';
export { setHooks, budget, checkBudget, charge, setLimits, jobs, job, submit, wait, cancel, retry, forget, markAttached, generate, ratioOf, editRequest, needsNote, writeStudioNote, refsLine, learnId, learnArgs } from './media/trabajos.mjs';

export function configure(officeCfg, brainPath, dataDir, h = {}) {
  const m = officeCfg.media || {};
  S.cfg = { dailyLimit: 40, maxPerRequest: 8, concurrency: 3, ...m, models: { ...DEFAULT_MODELS, ...(m.models || {}) } };
  setRoot(path.join(brainPath, 'Agents Office', 'media'));
  setFiles(dataDir, h);
  setCustom(m.custom); // your own models: office.config.json → media.custom
  loadJobs();
  startIndex(dataDir, h.warm !== false); // INF-03: the gallery's index, its snapshot and the first read in the background
}
