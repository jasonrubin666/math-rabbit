import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

// Art slots: each Scratch costume is addressable as "<Sprite>/<index>" (src/data/costumes.json, made by
// tools/app/costumes.py, holds where it sat on stage and which art image it shows). The image file comes
// from art/manifest.json: art/replace/NNN* wins over art/originals/..., so new art shows up here exactly
// as it does in the Scratch build. The app imports `virtual:art` to get each slot's URL and geometry.
const ART_DIR = path.resolve(import.meta.dirname, 'art');
const COSTUMES = path.resolve(import.meta.dirname, 'src/data/costumes.json');
const VIRTUAL_ID = 'virtual:art';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

type Costume = { image: number | null; name: string; stageW: number; stageH: number; centerX: number; centerY: number };
type Slot = Omit<Costume, 'image'> & { file: string };

function readSlots(): Map<string, Slot> {
  const manifest: { images: { id: number; file: string }[] } = JSON.parse(fs.readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'));
  const replaceDir = path.join(ART_DIR, 'replace');
  const replacements = fs.existsSync(replaceDir)
    ? fs.readdirSync(replaceDir).filter(n => /^\d{3}.*\.(png|svg|jpe?g|webp)$/i.test(n))
    : [];
  const fileOf = new Map<number, string>();
  for (const img of manifest.images) {
    const nnn = String(img.id).padStart(3, '0');
    const replacement = replacements.find(n => n.startsWith(nnn));
    fileOf.set(img.id, replacement ? path.join(replaceDir, replacement) : path.join(ART_DIR, img.file));
  }
  const costumes: Record<string, Costume> = JSON.parse(fs.readFileSync(COSTUMES, 'utf8'));
  const slots = new Map<string, Slot>();
  for (const [key, { image, ...geometry }] of Object.entries(costumes)) {
    // a replacement is drawn into the original costume's box on stage; blank costumes get no file
    const file = image === null ? '' : fileOf.get(image);
    if (file !== undefined) slots.set(key, { file, ...geometry });
  }
  return slots;
}

function artSlots(): Plugin {
  let isBuild = false;
  return {
    name: 'math-rabbit-art',
    configResolved(c) { isBuild = c.command === 'build'; },
    resolveId(id) { return id === VIRTUAL_ID ? RESOLVED_ID : undefined; },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const out: Record<string, Omit<Slot, 'file'> & { url: string }> = {};
      const urls = new Map<string, string>();   // one emitted asset per file, however many costumes share it
      for (const [key, s] of readSlots()) {
        if (s.file && !fs.existsSync(s.file)) continue;
        let url = s.file ? urls.get(s.file) : '';
        if (url === undefined) {
          this.addWatchFile(s.file);
          url = isBuild
            ? `__ART_URL_${this.emitFile({ type: 'asset', name: path.basename(s.file), source: fs.readFileSync(s.file) })}__`
            : '/@fs' + s.file;
          urls.set(s.file, url);
        }
        const { file: _file, ...geometry } = s;
        out[key] = { url, ...geometry };
      }
      let code = `export default ${JSON.stringify(out)};`;
      // asset references resolve to their final hashed paths at build time
      code = code.replace(/"__ART_URL_(\w+)__"/g, (_m, ref) => `import.meta.ROLLUP_FILE_URL_${ref}`);
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
        .replace(/"__SOUND_URL_(\w+)__"/g, (_m, ref) => `import.meta.ROLLUP_FILE_URL_${ref}`);
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
