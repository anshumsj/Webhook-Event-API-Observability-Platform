const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'backend/controllers');
const middlewareDir = path.join(__dirname, 'backend/middleware');
const routesDir = path.join(__dirname, 'backend/routes');

const filesToProcess = [
  ...fs.readdirSync(controllersDir).map(f => path.join(controllersDir, f)),
  path.join(middlewareDir, 'authMiddleware.js'),
  path.join(routesDir, 'authRoutes.js'),
  path.join(routesDir, 'webhookRoutes.js')
];

const statusCodeMap = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR'
};

for (const file of filesToProcess) {
  if (!file.endsWith('.js')) continue;
  if (!fs.existsSync(file)) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Pattern: res.status(XXX).json({ message: '...' })
  // Also catches: res.status(XXX).json({ success: false, message: '...' })
  content = content.replace(/res\.status\((\d+)\)\.json\(\{\s*(?:success:\s*false,\s*)?message:\s*([^,}]+)(?:,\s*requestId:\s*[^}]+)?\s*\}\)/g, (match, status, messageStr) => {
    const code = statusCodeMap[status] || 'ERROR';
    return `res.status(${status}).json({ error: { code: '${code}', message: ${messageStr.trim()}, requestId: req ? req.requestId : 'unknown' } })`;
  });

  // Pattern: message: { message: 'Too many ...' } inside rate limiters
  content = content.replace(/message:\s*\{\s*message:\s*([^}]+)\s*\}/g, (match, messageStr) => {
    return `message: { error: { code: 'RATE_LIMITED', message: ${messageStr.trim()} } }`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${path.basename(file)}`);
  }
}
