import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.woff2':'font/woff2','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.bin':'application/octet-stream' };
mime['.txt'] = 'text/plain; charset=utf-8';
const server = createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(root, '.' + pathname);
    const relative = path.relative(root, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
    let info = await stat(filename);
    if (info.isDirectory()) { filename = path.join(filename, 'index.html'); info = await stat(filename); }
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    const headers = { 'Content-Type':mime[path.extname(filename).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff' };
    let start = 0;
    let end = info.size - 1;
    let code = 200;
    if (request.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      if (!match || Number(match[1]) >= info.size) { response.writeHead(416, { 'Content-Range':`bytes */${info.size}` }).end(); return; }
      start = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
      if (end < start) { response.writeHead(416).end(); return; }
      code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(code, headers);
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(filename, { start, end });
    stream.on('error', () => response.destroy());
    request.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400, { 'Content-Type':'text/plain; charset=utf-8' });
    response.end('Không tìm thấy tài nguyên.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
