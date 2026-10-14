const fs = require('fs');

function fixFile(filePath, handleBuyRegex, renderRegex) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('import { useAuth }')) {
    content = content.replace('import React', 'import { useAuth } from "@/_core/hooks/useAuth";\nimport React');
    if (!content.includes('import { useAuth }')) {
      content = 'import { useAuth } from "@/_core/hooks/useAuth";\n' + content;
    }
  }

  if (!content.includes('import { AlertDialog')) {
    const alertImports = `import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";\n`;
    content = content.replace(/(import .*;\n)+/, match => match + alertImports);
  }

  // Find component start and add state
  // We'll just look for setCheckoutOpen
  if (!content.includes('const [authAlertOpen')) {
    content = content.replace(/const \[checkoutOpen, setCheckoutOpen\] = useState\(false\);/, 
      `const [checkoutOpen, setCheckoutOpen] = useState(false);\n  const [authAlertOpen, setAuthAlertOpen] = useState(false);\n  const { user } = useAuth();`);
  }

  // Update handler
  content = content.replace(handleBuyRegex, match => {
    return match.replace(/setCheckout/g, 'if (!user) { setAuthAlertOpen(true); return; }\n    setCheckout');
  });

  // Add Alert Dialog JSX
  const alertJsx = `
      <AlertDialog open={authAlertOpen} onOpenChange={setAuthAlertOpen}>
        <AlertDialogContent className="bg-[#09090b] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Authentication Required</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Please sign in to your account first to proceed with the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.href = "/signin"} className="bg-[#befe6c] text-black hover:bg-[#befe6c]/90">
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
`;

  content = content.replace(renderRegex, match => alertJsx + match);

  fs.writeFileSync(filePath, content);
}

// 1. DashboardPricingSection.tsx
try {
  let content = fs.readFileSync('client/src/components/dashboard/DashboardPricingSection.tsx', 'utf8');
  if (!content.includes('import { useAuth }')) {
    content = 'import { useAuth } from "@/_core/hooks/useAuth";\n' + content;
  }
  if (!content.includes('import { AlertDialog')) {
    content = content.replace('import { PearlButton }', 'import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";\nimport { PearlButton }');
  }
  if (!content.includes('authAlertOpen')) {
    content = content.replace('const [checkoutOpen, setCheckoutOpen] = useState(false);', 'const [checkoutOpen, setCheckoutOpen] = useState(false);\n  const [authAlertOpen, setAuthAlertOpen] = useState(false);\n  const _auth = useAuth();\n  const user = _auth.user;');
  }
  content = content.replace('const handleBuyClick = (plan: PricingPlan) => {', 'const handleBuyClick = (plan: PricingPlan) => {\n    if (!user) { setAuthAlertOpen(true); return; }');
  
  const alertJsx = `      <AlertDialog open={authAlertOpen} onOpenChange={setAuthAlertOpen}>
        <AlertDialogContent className="bg-[#09090b] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Authentication Required</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Please sign in to your account first to proceed with the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.href = "/signin"} className="bg-[#befe6c] text-black hover:bg-[#befe6c]/90">
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
`;
  if (!content.includes('AlertDialogTitle>Authentication Required')) {
    content = content.replace('{/* Checkout Modal */}', alertJsx + '\n      {/* Checkout Modal */}');
  }
  fs.writeFileSync('client/src/components/dashboard/DashboardPricingSection.tsx', content);
  console.log('Updated DashboardPricingSection.tsx');
} catch(e) { console.error(e) }

