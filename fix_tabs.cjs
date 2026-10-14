const fs = require('fs');
let code = fs.readFileSync('client/src/pages/AdminDashboard.tsx', 'utf8');

// Array update
code = code.replace(
  '"providers",\n            "operations",\n            "announcement",',
  '"providers",\n            "operations",\n            "gpt6-premium",\n            "announcement",'
);

// Label map update
code = code.replace(
  ': item === "operations"\n              ? "Operations"\n              : item === "announcement"',
  ': item === "operations"\n              ? "Operations"\n              : item === "gpt6-premium"\n              ? "GPT-6 Premium"\n              : item === "announcement"'
);

fs.writeFileSync('client/src/pages/AdminDashboard.tsx', code);
