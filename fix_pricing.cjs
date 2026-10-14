const fs = require('fs');

try {
  let content = fs.readFileSync('client/src/pages/Pricing.tsx', 'utf8');
  if (!content.includes('import { useAuth }')) {
    content = 'import { useAuth } from "@/_core/hooks/useAuth";\n' + content;
  }
  if (!content.includes('import { AlertDialog')) {
    content = content.replace('import { CheckoutModal }', 'import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";\nimport { CheckoutModal }');
  }
  if (!content.includes('authAlertOpen')) {
    content = content.replace('const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);', 'const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);\n  const [authAlertOpen, setAuthAlertOpen] = useState(false);\n  const { user } = useAuth();');
  }
  
  if (!content.includes('if (!user) { setAuthAlertOpen(true)')) {
    content = content.replace('const openCheckout = (rail: "upi" | "crypto", amount: number) => {', 'const openCheckout = (rail: "upi" | "crypto", amount: number) => {\n    if (!user) { setAuthAlertOpen(true); return; }');
  }

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
    content = content.replace('{/* Direct Settlement Checkout Modal for both UPI and Solana */}', alertJsx + '\n      {/* Direct Settlement Checkout Modal for both UPI and Solana */}');
  }
  fs.writeFileSync('client/src/pages/Pricing.tsx', content);
  console.log('Updated Pricing.tsx');
} catch(e) { console.error(e) }

