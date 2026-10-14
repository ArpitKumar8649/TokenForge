const fs = require('fs');

try {
  let content = fs.readFileSync('client/src/components/TransactionsWorkspace.tsx', 'utf8');
  if (!content.includes('import { useAuth }')) {
    content = 'import { useAuth } from "@/_core/hooks/useAuth";\n' + content;
  }
  if (!content.includes('import { AlertDialog')) {
    content = content.replace('import { CheckoutModal }', 'import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";\nimport { CheckoutModal }');
  }
  if (!content.includes('authAlertOpen')) {
    content = content.replace('const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);', 'const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);\n  const [authAlertOpen, setAuthAlertOpen] = useState(false);\n  // user is already available from useAuth');
  }
  
  content = content.replace(/onClick=\{\(\) \=\> setIsCheckoutOpen\(true\)\}/g, 'onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setIsCheckoutOpen(true); }}');

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
    content = content.replace('{/* Modal renders on top */}', alertJsx + '\n      {/* Modal renders on top */}');
  }
  fs.writeFileSync('client/src/components/TransactionsWorkspace.tsx', content);
  console.log('Updated TransactionsWorkspace.tsx');
} catch(e) { console.error(e) }

