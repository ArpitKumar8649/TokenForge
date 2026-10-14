const fs = require('fs');
let code = fs.readFileSync('client/src/components/admin/controls/Gpt6PremiumControls.tsx', 'utf8');

code = code.replace(/\\`\\\$\\{variables.email\\} now has GPT-6 Astra Premium Access\\`/g, '`${variables.email} now has GPT-6 Astra Premium Access`');
code = code.replace(/\\`Revoked premium access for \\\$\\{variables.email\\}\\`/g, '`Revoked premium access for ${variables.email}`');

fs.writeFileSync('client/src/components/admin/controls/Gpt6PremiumControls.tsx', code);
