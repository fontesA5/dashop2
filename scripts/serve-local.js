const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_PRODUCTS_FILE = path.join(__dirname, '..', 'backups', 'all_products_backup_2026_10_17.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(urlObj.pathname);

  // API Mocks for Local Preview
  if (pathname === '/api/products') {
    if (fs.existsSync(BACKUP_PRODUCTS_FILE)) {
      const data = fs.readFileSync(BACKUP_PRODUCTS_FILE);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
      return;
    }
  }

  if (pathname === '/api/orders' || pathname.startsWith('/api/orders/')) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify([]));
    return;
  }

  if (pathname === '/api/admin/login') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ success: true, token: 'local-preview-token' }));
    return;
  }

  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, pathname);

  // Check if direct file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Try appending .html (e.g. /catalog -> /catalog.html, /product -> /product.html)
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Server Error: ' + err.message);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`DASHOP Local Preview Server running at: http://localhost:${PORT}`);
  console.log(`- Catalog: http://localhost:${PORT}/catalog`);
  console.log(`- Admin Hub: http://localhost:${PORT}/admin/dashboard.html`);
});
