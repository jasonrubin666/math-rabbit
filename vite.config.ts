import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Art slots: every costume listed in art/manifest.csv (from tools/art/extract.py) is addressable as
// "<Sprite>/<index>". A file in art/replace/<Sprite>/ whose name starts with the same 3-digit number
// wins over art/original/<Sprite>/..., so new art shows up here exactly as it does in the Scratch build.
// The app imports `virtual:art` to get each slot's URL and on-stage geometry.
const ART_DIR = path.resolve(import.meta.dirname, 'art');
const VIRTUAL_ID = 'virtual:art';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

type Slot = { file: string; stageW: number; stageH: number; centerX: number; centerY: number; resolution: number };

function readSlots(): Map<string, Slot> {
  const csv = fs.readFileSync(path.join(ART_DIR, 'manifest.csv'), 'utf8').trim().split('\n');
  const head = csv[0].split(',');
  const col = (name: string) => head.indexOf(name);
  const slots = new Map<string, Slot>();
  for (const line of csv.slice(1)) {
    // costume names never contain commas; the trailing note column may be empty
    const f = line.split(',');
    const sprite = f[col('sprite')], index = +f[col('index')];
    const nnn = String(index).padStart(3, '0');
    const replaceDir = path.join(ART_DIR, 'replace', sprite);
    const replacement = fs.existsSync(replaceDir)
      ? fs.readdirSync(replaceDir).find(n => n.startsWith(nnn) && /\.(png|svg|jpe?g|webp)$/i.test(n))
      : undefined;
    const file = replacement ? path.join(replaceDir, replacement) : path.join(ART_DIR, 'original', f[col('file')]);
    slots.set(`${sprite}/${index}`, {
      file,
      // a replacement is drawn at the original's on-stage size (see "Replacing the art" in README.md)
      stageW: +f[col('stage_w')], stageH: +f[col('stage_h')],
      centerX: +f[col('center_x')] / +f[col('bitmap_resolution')], centerY: +f[col('center_y')] / +f[col('bitmap_resolution')],
      resolution: +f[col('bitmap_resolution')],
    });
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
      for (const [key, s] of readSlots()) {
        if (!fs.existsSync(s.file)) continue;
        this.addWatchFile(s.file);
        let url: string;
        if (isBuild) {
          const ref = this.emitFile({ type: 'asset', name: path.basename(s.file), source: fs.readFileSync(s.file) });
          url = `__ART_URL_${ref}__`;
        } else {
          url = '/@fs' + s.file;
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
      // new or changed art in art/replace/ reloads the page
      server.watcher.add(path.join(ART_DIR, 'replace'));
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(path.join(ART_DIR, 'replace'))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [artSlots()],
  server: { port: 5173, fs: { allow: ['.'] } },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
