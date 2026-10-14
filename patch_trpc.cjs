const fs = require('fs');
let code = fs.readFileSync('server/routers.ts', 'utf8');

const importsToAdd = `
  getGpt6AstraPremiumExemptions,
  setGpt6AstraPremiumExemption,
  removeGpt6AstraPremiumExemption,
`;

code = code.replace(
  'getPlatformMaintenanceExemptions,',
  'getPlatformMaintenanceExemptions,' + importsToAdd
);

const routesToAdd = `
    gpt6AstraPremiumExemptions: adminProcedure.query(() => getGpt6AstraPremiumExemptions()),
    setGpt6AstraPremiumExemption: adminProcedure.input(z.object({
      email: z.string().email("Enter a valid email address"),
    })).mutation(async ({ ctx, input }) => {
      const exemptions = await setGpt6AstraPremiumExemption(input.email, ctx.user.id);
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "gpt6_astra_premium_exemption_added", entityType: "user", entityId: input.email, metadata: { email: input.email } });
      return exemptions;
    }),
    removeGpt6AstraPremiumExemption: adminProcedure.input(z.object({
      email: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const exemptions = await removeGpt6AstraPremiumExemption(input.email, ctx.user.id);
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "gpt6_astra_premium_exemption_removed", entityType: "user", entityId: input.email, metadata: { email: input.email } });
      return exemptions;
    }),
`;

code = code.replace(
  'platformMaintenanceExemptions: adminProcedure.query(() => getPlatformMaintenanceExemptions()),',
  routesToAdd + '\n    platformMaintenanceExemptions: adminProcedure.query(() => getPlatformMaintenanceExemptions()),'
);

fs.writeFileSync('server/routers.ts', code);
