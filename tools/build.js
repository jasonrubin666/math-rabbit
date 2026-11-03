// Packages the Scratch project into docs/ (served by GitHub Pages) with the TurboWarp packager,
// then adds the iPad home-screen tags and the 3D rabbit bridge. docs/rabbit/ and the icons are kept.
//
//   npm i @turbowarp/packager && node tools/build.js MadDad.sb3 docs
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Packager = require('@turbowarp/packager');

const KEEP = new Set(['rabbit', 'apple-touch-icon.png', 'favicon.png', '.nojekyll']);
const HEAD_TAGS = `<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-fullscreen">
<meta name="apple-mobile-web-app-title" content="Math Rabbit">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="favicon.png">
`;
const BRIDGE_TAG = '<script type="module" src="rabbit/bridge.js"></script>\n';

(async () => {
  const [src, outDir] = process.argv.slice(2);
  const project = await Packager.loadProject(fs.readFileSync(src));
  const p = new Packager.Packager();
  p.project = project;
  p.options.target = 'zip';
  p.options.app.windowTitle = 'Math Rabbit';
  p.options.app.packageName = 'math-rabbit';
  p.options.loadingScreen.text = 'Math Rabbit';
  p.options.loadingScreen.progressBar = true;
  p.options.appearance.accent = '#ff4c4c';
  p.options.controls.fullscreen.enabled = true;
  // iPad: no text selection, long-press callouts, or double-tap/pinch zoom on the stage
  p.options.custom.css = `
html, body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
`;
  p.options.custom.js = `
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
`;
  const result = await p.package();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'math-rabbit-'));
  const zip = path.join(tmp, 'game.zip');
  fs.writeFileSync(zip, Buffer.from(result.data));
  execFileSync('unzip', ['-q', zip, '-d', path.join(tmp, 'game')]);

  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (!KEEP.has(name)) fs.rmSync(path.join(outDir, name), { recursive: true, force: true });
  }
  fs.cpSync(path.join(tmp, 'game'), outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

  const indexPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace('<meta name="theme-color" content="#000000">', m => `${m}\n${HEAD_TAGS}`);
  html = html.replace('user-scalable=no">', 'user-scalable=no, viewport-fit=cover">');
  html = html.replace(/<\/body>(?![\s\S]*<\/body>)/, `${BRIDGE_TAG}</body>`);
  fs.writeFileSync(indexPath, html);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('built', outDir);
})().catch(e => { console.error(e); process.exit(1); });
