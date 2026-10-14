const fs = require('fs');
let code = fs.readFileSync('server/renderNimBridgeRetirement.test.ts', 'utf8');
code = code.replace(
  'const adminSource = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");',
  'const adminSource = readFileSync(path.join(projectRoot, "client/src/components/admin/providers/ProvidersSection.tsx"), "utf8");'
);
fs.writeFileSync('server/renderNimBridgeRetirement.test.ts', code);
