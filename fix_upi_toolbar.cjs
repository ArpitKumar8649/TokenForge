const fs = require('fs');
let code = fs.readFileSync('client/src/components/TransactionsWorkspace.tsx', 'utf8');

code = code.replace(
  '          {/* UPI Filter & Search Toolbar */}\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">',
  '          {/* UPI Filter & Search Toolbar */}\n          {isAdmin && (\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">'
);
code = code.replace(
  '            </div>\n          </div>\n\n          {/* UPI QUEUE TABLE */}',
  '            </div>\n          </div>\n          )}\n\n          {/* UPI QUEUE TABLE */}'
);

fs.writeFileSync('client/src/components/TransactionsWorkspace.tsx', code);
