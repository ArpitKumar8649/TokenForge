const fs = require('fs');

try {
  let content = fs.readFileSync('client/src/pages/DeveloperDashboard.tsx', 'utf8');
  if (!content.includes('import { AlertDialog')) {
    content = content.replace('import { PearlButton }', 'import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";\nimport { PearlButton }');
  }
  if (!content.includes('authAlertOpen')) {
    content = content.replace('const [checkoutOpen, setCheckoutOpen] = useState(false);', 'const [checkoutOpen, setCheckoutOpen] = useState(false);\n  const [authAlertOpen, setAuthAlertOpen] = useState(false);\n  // user is already destructured from useAuth above');
  }
  
  // DeveloperDashboard.tsx has a click handler directly in the button
  content = content.replace(/onClick=\{\(\) \=\> \{\n\s*setCheckoutRail/g, 'onClick={() => {\n                  if (!user) { setAuthAlertOpen(true); return; }\n                  setCheckoutRail');

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
    content = content.replace('{/* Direct Checkout Modal */}', alertJsx + '\n      {/* Direct Checkout Modal */}');
  }
  fs.writeFileSync('client/src/pages/DeveloperDashboard.tsx', content);
  console.log('Updated DeveloperDashboard.tsx');
} catch(e) { console.error(e) }

