// Static server for tests/fixtures/live, used by Playwright as the DKU
// upstream so e2e runs against the committed snapshot instead of the live site.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'tests/fixtures/live');
const port = Number(process.env.PORT ?? 8788);

const contentTypes: Record<string, string> = {
	'.htm': 'text/html; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8'
};

createServer(async (req, res) => {
	try {
		const url = new URL(req.url ?? '/', 'http://localhost');
		let pathname = decodeURIComponent(url.pathname);
		if (pathname.endsWith('/')) pathname += 'index.html';
		const filePath = path.join(root, pathname);
		if (!filePath.startsWith(root + path.sep)) {
			res.writeHead(403);
			res.end();
			return;
		}
		const body = await readFile(filePath);
		const type = contentTypes[path.extname(filePath)] ?? 'application/octet-stream';
		res.writeHead(200, { 'content-type': type });
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
}).listen(port, () => {
	console.log(`Fixture server: http://127.0.0.1:${port} -> ${root}`);
});
