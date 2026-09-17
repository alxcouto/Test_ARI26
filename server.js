const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let targetPath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

    fs.stat(targetPath, (err, stats) => {
        if (!err && stats.isFile()) {
            return serveFile(res, targetPath);
        }
        
        if (!err && stats.isDirectory()) {
            let indexPath = path.join(targetPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                return serveFile(res, indexPath);
            }
        }

        // Fallback to root index.html
        let rootIndex = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(rootIndex)) {
            return serveFile(res, rootIndex);
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`LiveSpeech Web Client server running on port ${PORT}`);
});
