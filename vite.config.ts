import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

// Art slots: each Scratch costume is addressable as "<Sprite>/<index>" (src/data/costumes.json, made by
// tools/app/costumes.py, holds where it sat on stage and which art image it shows). The image file comes
// from art/manifest.json: art/replace/NNN* wins over art/originals/... (.jpg over .png when both exist), so new art shows up here exactly
// as it does in the Scratch build. The app imports `virtual:art` to get each slot's URL and geometry.
const ART_DIR = path.resolve(import.meta.dirname, 'art');
const COSTUMES = path.resolve(import.meta.dirname, 'src/data/costumes.json');
const VIRTUAL_ID = 'virtual:art';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Where a shared image sits inside a costume's box (costume units, rotated clockwise about x, y). */
type Place = { x: number; y: number; w: number; h: number; rotate: number };
type Costume = { image: number | null; name: string; stageW: number; stageH: number; centerX: number; centerY: number; place?: Place };
/** One run of text, drawn with a font instead of an image (art/manifest.json images[].text[]). */
export type TextRun = {
  text: string; font: string; color: string;
  /** font size, and x/y (the start of the baseline from the image's top-left), in costume units */
  size: number; x?: number; y?: number;
  rotate?: number; anchor?: 'start' | 'middle' | 'end';
  stroke?: string | null; stroke_width?: number | null;
  over_base?: boolean; center?: boolean;
};
type ManifestImage = {
  id: number; file: string; stage_w: number; stage_h: number;
  kind?: 'art' | 'text' | 'text on art'; text?: TextRun[]; base?: number;
};
type Slot = Omit<Costume, 'image'> & {
  /** '' when nothing is drawn from a file (a blank costume, or text only) */
  file: string;
  /** text costumes: the image's own size, which the runs (and the shape under them) are laid out in;
   *  the costume can show the image scaled (the card numbers reuse one image at several sizes) */
  textW?: number; textH?: number;
  /** for text on a shape: the shape's own size (it shares the image's top-left) */
  fileW?: number; fileH?: number;
  text?: TextRun[];
};

/** Art the game shows outside any Scratch costume (the rabbit's desk), by manifest id. */
type Extra = { file: string; stageW: number; stageH: number };

function readArt(): { slots: Map<string, Slot>; extras: Map<number, Extra> } {
  const manifest: { images: ManifestImage[]; shapes?: ManifestImage[]; extras?: ManifestImage[] } =
    JSON.parse(fs.readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'));
  const replaceDir = path.join(ART_DIR, 'replace');
  const replacements = fs.existsSync(replaceDir)
    ? fs.readdirSync(replaceDir).filter(n => /^\d{3}.*\.(png|svg|jpe?g|webp)$/i.test(n))
    : [];
  // When one image has several files (say a full-quality .png kept next to its compressed .jpg), the
  // web-friendly one wins: .jpg/.jpeg, then .webp, then .png, then .svg.
  const PREFERENCE = ['jpg', 'jpeg', 'webp', 'png', 'svg'];
  const rank = (n: string) => PREFERENCE.indexOf(n.split('.').pop()!.toLowerCase());
  const replacementOf = (id: number) => {
    const nnn = String(id).padStart(3, '0');
    const r = replacements.filter(n => n.startsWith(nnn) && !/\d/.test(n[3] ?? '')).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
    return r && path.join(replaceDir, r);
  };
  const byId = new Map<number, ManifestImage>();
  for (const img of [...manifest.images, ...(manifest.shapes ?? []), ...(manifest.extras ?? [])]) byId.set(img.id, img);
  const fileOf = (id: number) => { const img = byId.get(id); return img && (replacementOf(id) ?? path.join(ART_DIR, img.file)); };

  // What an image draws: a drawn replacement always wins; otherwise text is set in a font
  // (on its shape, for "text on art") and only real art comes from its original file.
  type Drawing = Pick<Slot, 'file' | 'textW' | 'textH' | 'fileW' | 'fileH' | 'text'>;
  const drawingOf = (id: number): Drawing | undefined => {
    const img = byId.get(id);
    if (!img) return undefined;
    const replacement = replacementOf(id);
    if (replacement || !img.text?.length || img.kind === 'art' || !img.kind) return { file: replacement ?? path.join(ART_DIR, img.file) };
    const text = { text: img.text, textW: img.stage_w, textH: img.stage_h };
    if (img.kind === 'text') return { file: '', ...text };
    const base = img.base !== undefined ? byId.get(img.base) : undefined;
    if (!base) return { file: path.join(ART_DIR, img.file) };
    return { file: fileOf(base.id)!, fileW: base.stage_w, fileH: base.stage_h, ...text };
  };

  const costumes: Record<string, Costume> = JSON.parse(fs.readFileSync(COSTUMES, 'utf8'));
  const slots = new Map<string, Slot>();
  for (const [key, { image, ...geometry }] of Object.entries(costumes)) {
    // a replacement is drawn into the original costume's box on stage; blank costumes get no file
    const drawing = image === null ? { file: '' } : drawingOf(image);
    if (drawing) slots.set(key, { ...drawing, ...geometry });
  }
  const extras = new Map<number, Extra>();
  for (const img of manifest.extras ?? []) extras.set(img.id, { file: fileOf(img.id)!, stageW: img.stage_w, stageH: img.stage_h });
  return { slots, extras };
}

function artSlots(): Plugin {
  let isBuild = false;
  return {
    name: 'math-rabbit-art',
    configResolved(c) { isBuild = c.command === 'build'; },
    resolveId(id) { return id === VIRTUAL_ID ? RESOLVED_ID : undefined; },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const { slots, extras } = readArt();
      const urls = new Map<string, string>();   // one emitted asset per file, however many costumes share it
      const urlOf = (file: string) => {
        let url = urls.get(file);
        if (url === undefined) {
          this.addWatchFile(file);
          url = isBuild
            ? `__ART_URL_${this.emitFile({ type: 'asset', name: path.basename(file), source: fs.readFileSync(file) })}__`
            : '/@fs' + file;
          urls.set(file, url);
        }
        return url;
      };
      const out: Record<string, Omit<Slot, 'file'> & { url: string }> = {};
      for (const [key, s] of slots) {
        if (s.file && !fs.existsSync(s.file)) continue;
        const { file, ...geometry } = s;
        out[key] = { url: file ? urlOf(file) : '', ...geometry };
      }
      const outExtras: Record<number, Omit<Extra, 'file'> & { url: string }> = {};
      for (const [id, { file, ...size }] of extras) if (fs.existsSync(file)) outExtras[id] = { url: urlOf(file), ...size };
      let code = `export default ${JSON.stringify(out)};\nexport const extras = ${JSON.stringify(outExtras)};`;
      // asset references resolve to their final hashed paths at build time
      code = code.replace(/"__ART_URL_([\w$]+)__"/g, (_m, ref) => `import.meta.ROLLUP_FILE_URL_${ref}`);
      return code;
    },
    configureServer(server) {
      // new or changed art in art/replace/ (or a regenerated manifest) reloads the page
      const manifest = path.join(ART_DIR, 'manifest.json');
      server.watcher.add([path.join(ART_DIR, 'replace'), manifest]);
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(path.join(ART_DIR, 'replace')) && file !== manifest) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// Sounds come straight out of the Scratch project by name (Stage's copy wins when sprites share a name).
// A file in sounds/replace/ named "<sound name>.<ext>" replaces it, e.g. sounds/replace/Correct1.mp3.
const SB3 = path.resolve(import.meta.dirname, 'MadDad.sb3');
const SOUNDS_REPLACE = path.resolve(import.meta.dirname, 'sounds/replace');
const SOUNDS_ID = 'virtual:sounds';

function readSounds(): Map<string, { file: string; data: () => Uint8Array }> {
  const zip = unzipSync(fs.readFileSync(SB3));
  const project = JSON.parse(strFromU8(zip['project.json']));
  const out = new Map<string, { file: string; data: () => Uint8Array }>();
  const targets = [...project.targets].sort((a: { isStage: boolean }, b: { isStage: boolean }) => +b.isStage - +a.isStage);
  for (const t of targets) {
    for (const s of t.sounds as { name: string; md5ext: string }[]) {
      if (!out.has(s.name)) out.set(s.name, { file: s.md5ext, data: () => zip[s.md5ext] });
    }
  }
  if (fs.existsSync(SOUNDS_REPLACE)) {
    for (const f of fs.readdirSync(SOUNDS_REPLACE)) {
      const name = f.replace(/\.(wav|mp3|m4a|ogg)$/i, '');
      if (name !== f) out.set(name, { file: f, data: () => fs.readFileSync(path.join(SOUNDS_REPLACE, f)) });
    }
  }
  return out;
}

function sounds(): Plugin {
  let isBuild = false;
  let cache: ReturnType<typeof readSounds> | undefined;
  const get = () => (cache ??= readSounds());
  return {
    name: 'math-rabbit-sounds',
    configResolved(c) { isBuild = c.command === 'build'; },
    resolveId(id) { return id === SOUNDS_ID ? '\0' + SOUNDS_ID : undefined; },
    load(id) {
      if (id !== '\0' + SOUNDS_ID) return;
      const urls: Record<string, string> = {};
      for (const [name, s] of get()) {
        urls[name] = isBuild
          ? `__SOUND_URL_${this.emitFile({ type: 'asset', name: s.file, source: s.data() })}__`
          : `/@sounds/${encodeURIComponent(name)}`;
      }
      return `export default ${JSON.stringify(urls)};`
        .replace(/"__SOUND_URL_([\w$]+)__"/g, (_m, ref) => `import.meta.ROLLUP_FILE_URL_${ref}`);
    },
    configureServer(server) {
      server.middlewares.use('/@sounds/', (req, res, next) => {
        const s = get().get(decodeURIComponent((req.url ?? '').slice(1).split('?')[0]));
        if (!s) return next();
        res.setHeader('Content-Type', s.file.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav');
        res.end(Buffer.from(s.data()));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [artSlots(), sounds()],
  server: { port: 5173, fs: { allow: ['.'] } },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
