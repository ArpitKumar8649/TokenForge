const fs = require('fs');
let code = fs.readFileSync('client/src/pages/AdminDashboard.tsx', 'utf8');

// Add to section types
code = code.replace(
  '"overview" | "accounts" | "settlements" | "requests" | "tickets" | "campaign" | "controls" | "providers" | "operations" | "announcement" | "activity" | "live"',
  '"overview" | "accounts" | "settlements" | "requests" | "tickets" | "campaign" | "controls" | "providers" | "operations" | "gpt6-premium" | "announcement" | "activity" | "live"'
);

// Add import
const importToAdd = `import { Gpt6PremiumControls } from "@/components/admin/controls/Gpt6PremiumControls";\n`;
code = code.replace(
  'import { OperationalControls } from "@/components/admin/controls/OperationalControls";',
  'import { OperationalControls } from "@/components/admin/controls/OperationalControls";\n' + importToAdd
);

// Add Sidebar Tab
const sidebarTab = `          <SidebarTab
            icon={<Gauge size={16} />}
            label="GPT-6 Premium"
            active={section === "gpt6-premium"}
            onClick={() => setSection("gpt6-premium")}
          />
`;
code = code.replace(
  'label="Operations"\n            active={section === "operations"}\n            onClick={() => setSection("operations")}\n          />',
  'label="Operations"\n            active={section === "operations"}\n            onClick={() => setSection("operations")}\n          />\n' + sidebarTab
);

// Add Tab mapping
const tabSection = `      {section === "gpt6-premium" && <Gpt6PremiumControls />}`;
code = code.replace(
  '{section === "operations" && <OperationalControls />}',
  '{section === "operations" && <OperationalControls />}\n' + tabSection
);

fs.writeFileSync('client/src/pages/AdminDashboard.tsx', code);
