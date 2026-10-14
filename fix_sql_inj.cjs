const fs = require('fs');
let code = fs.readFileSync('server/solanaPayGateway.ts', 'utf8');

const replacement = `  const handleGetPaidUsers = async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database unavailable" });
      }

      const userId = (req as any).session?.userId;
      const userRole = (req as any).session?.role;
      const isAdminRoute = req.path.includes('/api/admin/');

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const isAdminRequest = isAdminRoute && userRole === 'admin';

      let query;
      if (isAdminRequest) {
        query = sql\`
          SELECT 
            so.order_id as orderId,
            so.user_id as userId,
            COALESCE(so.user_email, u.email) as userEmail,
            COALESCE(so.user_name, u.name) as userName,
            so.sol_amount as solAmount,
            so.usd_amount as usdAmount,
            so.credits_nanos as creditsNanos,
            so.signature,
            so.created_at as createdAt,
            so.completed_at as completedAt,
            so.status
          FROM solana_orders so
          LEFT JOIN users u ON so.user_id = u.id
          WHERE so.status IN ("PAID", "COMPLETED")
          ORDER BY so.completed_at DESC, so.created_at DESC
        \`;
      } else {
        query = sql\`
          SELECT 
            so.order_id as orderId,
            so.user_id as userId,
            COALESCE(so.user_email, u.email) as userEmail,
            COALESCE(so.user_name, u.name) as userName,
            so.sol_amount as solAmount,
            so.usd_amount as usdAmount,
            so.credits_nanos as creditsNanos,
            so.signature,
            so.created_at as createdAt,
            so.completed_at as completedAt,
            so.status
          FROM solana_orders so
          LEFT JOIN users u ON so.user_id = u.id
          WHERE so.status IN ("PAID", "COMPLETED") AND so.user_id = \${userId}
          ORDER BY so.completed_at DESC, so.created_at DESC
        \`;
      }
      
      const rows = await db.execute(query);`;


code = code.replace(/  const handleGetPaidUsers = async \(req: Request, res: Response\) => \{\n    try \{\n      const db = await getDb\(\);\n      if \(!db\) \{\n        return res\.status\(500\)\.json\(\{ error: "Database unavailable" \}\);\n      \}\n\n      const userId = \(req as any\)\.session\?\.userId;\n      const userRole = \(req as any\)\.session\?\.role;\n      const isAdminRoute = req\.path\.includes\('\/api\/admin\/'\);\n\n      if \(!userId\) \{\n        return res\.status\(401\)\.json\(\{ error: "Unauthorized" \}\);\n      \}\n\n      \/\/ If it's an admin request from an admin user, don't filter by user_id\n      const isAdminRequest = isAdminRoute && userRole === 'admin';\n\n      const rows = await db\.execute\(sql`\n        SELECT \n          so\.order_id as orderId,\n          so\.user_id as userId,\n          COALESCE\(so\.user_email, u\.email\) as userEmail,\n          COALESCE\(so\.user_name, u\.name\) as userName,\n          so\.sol_amount as solAmount,\n          so\.usd_amount as usdAmount,\n          so\.credits_nanos as creditsNanos,\n          so\.signature,\n          so\.created_at as createdAt,\n          so\.completed_at as completedAt,\n          so\.status\n        FROM solana_orders so\n        LEFT JOIN users u ON so\.user_id = u\.id\n        WHERE so\.status IN \("PAID", "COMPLETED"\) \$\{\!isAdminRequest \? sql`AND so\.user_id = \$\{userId\}`\.sql : ""\}\n        ORDER BY so\.completed_at DESC, so\.created_at DESC\n      `\);/g, replacement);

fs.writeFileSync('server/solanaPayGateway.ts', code);
