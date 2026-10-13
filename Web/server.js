const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 5500;
const webRoot = __dirname;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

const server = http.createServer((request, response) => {
  let requestPath;

  try {
    requestPath = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  } catch {
    sendError(response, 400, 'Bad request');
    return;
  }

  const relativePath = requestPath === '/' ? 'MVweb.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(webRoot, relativePath);

  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
    sendError(response, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendError(response, 404, 'Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) sendError(response, 500, 'Server error');
      else response.destroy();
    });
    stream.pipe(response);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Set another port with: $env:PORT=5501; npm run dev`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`MULTIVENT web page: http://${host}:${port}`);
  console.log('Press Ctrl+C to stop the server.');
});
