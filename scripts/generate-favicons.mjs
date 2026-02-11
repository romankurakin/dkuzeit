#!/usr/bin/env node
// Favicon generation pipeline
// Converts <text> to <path> using opentype.js, generates all favicon sizes
// Usage: node scripts/generate-favicons.mjs

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STATIC = join(ROOT, 'static');
const ICONS = join(STATIC, 'icons');

// ── Step 1: Text → Path via opentype.js ──

const FONT_PATH = '/Library/Fonts/SF-Pro-Display-Black.otf';

// opentype.js uses require('fs') internally — use createRequire for CJS compat
import { createRequire } from 'node:module';
execSync('npm install --prefix /tmp opentype.js', { stdio: 'pipe' });
const require = createRequire(import.meta.url);
const opentype = require('/tmp/node_modules/opentype.js');

const font = opentype.loadSync(FONT_PATH);

function textToPath(text, cx, baselineY, fontSize) {
	// opentype.js getPath(text, x, y, size) — y is the baseline
	const probe = font.getPath(text, 0, 0, fontSize);
	const bbox = probe.getBoundingBox();
	const width = bbox.x2 - bbox.x1;
	const centered = font.getPath(text, cx - width / 2 - bbox.x1, baselineY, fontSize);
	return centered.toSVG();
}

// Match original: text-anchor=middle x=64 y=41 size=22 / x=64 y=73 size=22
const dkuPath = textToPath('DKU', 64, 41, 22);
const zeitPath = textToPath('ZEIT', 64, 73, 22);

// Extract just the d="" attribute from <path d="..."/>
function extractD(svgPath) {
	const match = svgPath.match(/d="([^"]+)"/);
	return match ? match[1] : '';
}

// ── Step 2: Generate master SVG ──

const masterSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<style>
  .bg { fill: #141414 }
  @media (prefers-color-scheme: light) { .bg { fill: #fbfbfb } }
</style>
<rect class="bg" width="128" height="128"/>
<rect x="20" y="20" width="88" height="28" fill="#86efac"/>
<path d="${extractD(dkuPath)}" fill="#141414"/>
<rect x="20" y="52" width="88" height="28" fill="#c4b5fd"/>
<path d="${extractD(zeitPath)}" fill="#141414"/>
<rect x="20" y="84" width="27" height="24" fill="#fda4af"/>
<rect x="50" y="84" width="28" height="24" fill="#fcd34d"/>
<rect x="81" y="84" width="27" height="24" fill="#7dd3fc"/>
</svg>`;

writeFileSync(join(ICONS, 'icon.svg'), masterSVG);
writeFileSync(join(STATIC, 'icon.svg'), masterSVG);
console.log('✓ Master SVG generated');

// ── Step 3: SVG → PNG rasterization ──

// For rasterization: strip media queries, hardcode dark bg
const rasterSVG = masterSVG
	.replace(/<style>[\s\S]*?<\/style>/, '')
	.replace('class="bg" ', 'fill="#141414" ');

const rasterSVGPath = '/tmp/favicon-raster.svg';
writeFileSync(rasterSVGPath, rasterSVG);

function rsvg(input, output, size) {
	execSync(`rsvg-convert -w ${size} -h ${size} "${input}" -o "${output}"`);
	console.log(`  → ${output} (${size}×${size})`);
}

// Direct renders
rsvg(rasterSVGPath, join(STATIC, 'icon-512.png'), 512);
rsvg(rasterSVGPath, join(STATIC, 'icon-192.png'), 192);

// Favicon source
rsvg(rasterSVGPath, '/tmp/favicon-32.png', 32);

// Apple touch icon: 180×180 with ~140×140 icon centered, #141414 bg
rsvg(rasterSVGPath, '/tmp/apple-icon-140.png', 140);
execSync(
	`magick /tmp/apple-icon-140.png -background "#141414" -gravity center -extent 180x180 "${join(STATIC, 'apple-touch-icon.png')}"`
);
console.log('  → apple-touch-icon.png (180×180, padded)');

// Maskable icon: 512×512 with ~360×360 icon centered, #141414 bg
rsvg(rasterSVGPath, '/tmp/mask-icon-360.png', 360);
execSync(
	`magick /tmp/mask-icon-360.png -background "#141414" -gravity center -extent 512x512 "${join(STATIC, 'icon-mask.png')}"`
);
console.log('  → icon-mask.png (512×512, safe zone)');

console.log('✓ PNG rasterization complete');

// ── Step 4: Lossless PNG optimization ──

const pngs = ['icon-512.png', 'icon-192.png', 'apple-touch-icon.png', 'icon-mask.png']
	.map((f) => `"${join(STATIC, f)}"`)
	.join(' ');

execSync(`npx oxipng-bin --strip safe -o 4 ${pngs}`, { cwd: ROOT, stdio: 'pipe' });
console.log('✓ PNG optimization complete');

// ── Step 5: PNG → ICO ──

execSync(`magick /tmp/favicon-32.png "${join(STATIC, 'favicon.ico')}"`);
console.log('✓ favicon.ico generated');

// ── Step 6: Verify ──

console.log('\nVerification:');
const files = [
	'icon.svg',
	'icons/icon.svg',
	'icon-512.png',
	'icon-192.png',
	'apple-touch-icon.png',
	'icon-mask.png',
	'favicon.ico'
];
for (const f of files) {
	const full = join(STATIC, f);
	if (f.endsWith('.png')) {
		const info = execSync(`magick identify "${full}"`).toString().trim();
		console.log(`  ${f}: ${info}`);
	} else {
		const stat = execSync(`wc -c < "${full}"`).toString().trim();
		console.log(`  ${f}: ${stat} bytes`);
	}
}

console.log('\n✅ All favicons generated successfully');
