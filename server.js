const crypto = require('crypto');

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'admin-config.json');

// ========== Secure Admin Credentials ==========
// Hashed username and password (using PBKDF2 with SHA-512)
// Default: admin / Mm123456
const ADMIN_USERNAME_HASH = 'c7ad44cbad762a5da0a452f9e854fdc1e0e7a52a38015f234c8c32f938969f66'; // SHA-256 of 'admin'
const ADMIN_PASSWORD_SALT = '8f7b5a329d4c1e0a';
const ADMIN_PASSWORD_HASH = '8547ea627e23c472001c688fb7d8006c6808a8b24e54d89048d060236bf938969f3c44f259daa07e9b6b34b68be602bb2ffa6d87f5228f9d6f76f5cd89e07bc2';
// ===============================================

// MIME types for static serving
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
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Load saved config (API keys)
function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  return { geminiKey: '', elevenLabsKey: '' };
}

// Save config to file
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  console.log('✅ Config saved successfully');
}

// Verify admin credentials securely
function verifyAuth(username, password) {
  if (!username || !password) return false;
  
  // 1. Hash the username with SHA-256
  const usernameHash = crypto.createHash('sha256').update(username).digest('hex');
  
  // 2. Hash the password with PBKDF2 using SHA-512 and salt
  const passwordHash = crypto.pbkdf2Sync(
    password, 
    ADMIN_PASSWORD_SALT, 
    100000, // iterations
    64,     // key length
    'sha512'
  ).toString('hex');
  
  // 3. Constant-time comparison (to prevent timing attacks)
  try {
    const isUsernameMatch = crypto.timingSafeEqual(
      Buffer.from(usernameHash, 'hex'),
      Buffer.from(ADMIN_USERNAME_HASH, 'hex')
    );
    const isPasswordMatch = crypto.timingSafeEqual(
      Buffer.from(passwordHash, 'hex'),
      Buffer.from(ADMIN_PASSWORD_HASH, 'hex')
    );
    return isUsernameMatch && isPasswordMatch;
  } catch (e) {
    return false;
  }
}

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Serve static files
function serveStatic(req, res) {
  let urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    // No cache for development
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ===== API Routes =====

  // GET /api/config — Return saved API keys (for all clients)
  if (req.method === 'GET' && url.pathname === '/api/config') {
    const config = getConfig();
    sendJSON(res, 200, {
      geminiKey: config.geminiKey || '',
      elevenLabsKey: config.elevenLabsKey || '',
      hasCustomGemini: !!config.geminiKey,
      hasCustomEleven: !!config.elevenLabsKey
    });
    return;
  }

  // POST /api/admin/login — Verify admin credentials
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    try {
      const body = await parseBody(req);
      if (verifyAuth(body.username, body.password)) {
        sendJSON(res, 200, { success: true, message: 'تم تسجيل الدخول ✅' });
      } else {
        sendJSON(res, 401, { success: false, message: 'يوزر أو باسورد غلط ❌' });
      }
    } catch {
      sendJSON(res, 400, { success: false, message: 'طلب غير صالح' });
    }
    return;
  }

  // POST /api/config — Save API keys (requires auth)
  if (req.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = await parseBody(req);
      
      // Verify admin credentials
      if (!verifyAuth(body.username, body.password)) {
        sendJSON(res, 401, { success: false, message: 'غير مصرح! يوزر أو باسورد غلط ❌' });
        return;
      }

      // Save config
      const currentConfig = getConfig();
      if (body.geminiKey !== undefined) {
        currentConfig.geminiKey = body.geminiKey.trim();
      }
      if (body.elevenLabsKey !== undefined) {
        currentConfig.elevenLabsKey = body.elevenLabsKey.trim();
      }
      saveConfig(currentConfig);

      sendJSON(res, 200, { success: true, message: 'تم حفظ الـ Keys بنجاح ✅' });
    } catch {
      sendJSON(res, 400, { success: false, message: 'طلب غير صالح' });
    }
    return;
  }

  // DELETE /api/config — Reset to defaults (requires auth)
  if (req.method === 'DELETE' && url.pathname === '/api/config') {
    try {
      const body = await parseBody(req);
      
      if (!verifyAuth(body.username, body.password)) {
        sendJSON(res, 401, { success: false, message: 'غير مصرح! ❌' });
        return;
      }

      saveConfig({ geminiKey: '', elevenLabsKey: '' });
      sendJSON(res, 200, { success: true, message: 'تم الرجوع للافتراضي ✅' });
    } catch {
      sendJSON(res, 400, { success: false, message: 'طلب غير صالح' });
    }
    return;
  }

  // ===== Static Files =====
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n🚀 CorrectMe Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Admin Panel: http://localhost:${PORT}/?admin=1`);
  console.log(`\n🔐 Admin: ${ADMIN_USERNAME} / ${'*'.repeat(ADMIN_PASSWORD.length)}`);
  console.log(`\n📁 Serving files from: ${__dirname}\n`);
});
