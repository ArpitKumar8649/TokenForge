const fs = require('fs');
let code = fs.readFileSync('client/src/components/TransactionsWorkspace.tsx', 'utf8');

// 1. Hide the Solana Metrics Banner for non-admins
code = code.replace(
  '          {/* Solana Metrics Banner */}\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">',
  '          {/* Solana Metrics Banner */}\n          {adminMode && (\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">'
);
code = code.replace(
  '            </div>\n          </div>\n\n          {/* View Mode & Search Toolbar */}',
  '            </div>\n          </div>\n          )}\n\n          {/* View Mode & Search Toolbar */}'
);

// 2. Hide the View Mode switcher for non-admins, but maybe keep the search bar for them if they have many transactions? The user said "remove all those blocks or cards just user history of transactions". Let's hide the whole toolbar for non-admins.
code = code.replace(
  '          {/* View Mode & Search Toolbar */}\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">',
  '          {/* View Mode & Search Toolbar */}\n          {adminMode && (\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">'
);
code = code.replace(
  '              )}\n            </div>\n          </div>\n\n          {/* VIEW A: PAID USERS TABLE */}',
  '              )}\n            </div>\n          </div>\n          )}\n\n          {/* VIEW A: PAID USERS TABLE */}'
);

// 3. Update the Empty State text
code = code.replace(
  '<h3 className="text-base font-bold text-white">No paid users found</h3>',
  '<h3 className="text-base font-bold text-white">{adminMode ? "No paid users found" : "No transaction history"}</h3>'
);

code = code.replace(
  ': "When users pay using Solana Pay, their email ID, amount paid, credits granted, and timestamp will appear in this table."}',
  ': (adminMode ? "When users pay using Solana Pay, their email ID, amount paid, credits granted, and timestamp will appear in this table." : "Your Solana Pay transaction history will appear here once you complete a payment.")}'
);

// 4. In standard mode, we probably don't need the User Email column since it's all their own transactions. But they might still want to see the details, let's just leave the column or modify it? Leaving the table structure is safer, just hiding the aggregate cards is what the user asked.

fs.writeFileSync('client/src/components/TransactionsWorkspace.tsx', code);
