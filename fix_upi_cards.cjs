const fs = require('fs');
let code = fs.readFileSync('client/src/components/TransactionsWorkspace.tsx', 'utf8');

code = code.replace(
  '          {/* UPI Summary Metrics */}\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">',
  '          {/* UPI Summary Metrics */}\n          {adminMode && (\n          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">'
);

code = code.replace(
  '          {/* UPI Toolbar */}',
  '          )}\n\n          {/* UPI Toolbar */}'
);

// For UPI toolbar, let's keep the filter (status) or hide it too?
// Normal users might want to filter pending vs approved. But the prompt said "remove all those blocks or cards just user history of transactions".
code = code.replace(
  '          {/* UPI Toolbar */}\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">',
  '          {/* UPI Toolbar */}\n          {adminMode && (\n          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10">'
);
code = code.replace(
  '            </div>\n          </div>\n\n          {/* UPI QUEUE TABLE */}',
  '            </div>\n          </div>\n          )}\n\n          {/* UPI QUEUE TABLE */}'
);

fs.writeFileSync('client/src/components/TransactionsWorkspace.tsx', code);
