const fs = require('fs');
let code = fs.readFileSync('client/src/components/admin/controls/OperationalControls.tsx', 'utf8');

// The injected UI:
const uiToDel = `      <section className="dashboard-card mt-4">
        <SectionHeader
          icon={<Gauge size={17} />}
          title="GPT-6 Astra Premium Access"
          description="Grant specific users free access to the GPT-6 Astra model without requiring a paid tier."
        />
        <div className="p-4 sm:p-5">
          <form onSubmit={handleAddGpt6Exemption} className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={newGpt6ExemptEmail}
              onChange={(e) => setNewGpt6ExemptEmail(e.target.value)}
              className="max-w-[300px] h-9 bg-white/5 border-white/10 placeholder:text-slate-500 text-sm"
              disabled={addGpt6ExemptionMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!newGpt6ExemptEmail.trim() || addGpt6ExemptionMutation.isPending}
              className="h-9 bg-white/10 hover:bg-white/20 text-white"
            >
              {addGpt6ExemptionMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4 mr-1" />}
              Grant Access
            </Button>
          </form>

          {gpt6PremiumExemptions.isLoading ? (
            <div className="mt-4 flex items-center justify-center py-6 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : gpt6PremiumExemptions.data?.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500 py-4 px-3 bg-white/5 rounded-lg border border-white/5">
              No users have been granted premium exemption yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Premium Exemptions</p>
              <div className="bg-black/20 border border-white/5 rounded-lg divide-y divide-white/5 overflow-hidden">
                {gpt6PremiumExemptions.data?.map((entry) => (
                  <div key={entry.email} className="flex items-center justify-between p-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">{entry.email}</span>
                      <span className="text-[10px] text-slate-500">
                        Granted at {new Date(entry.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeGpt6ExemptionMutation.mutate({ email: entry.email })}
                      disabled={removeGpt6ExemptionMutation.isPending}
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>`;

code = code.replace(uiToDel, '');

// Also remove the imports and hooks we added earlier.
const q1 = `  const gpt6PremiumExemptions = trpc.admin.gpt6AstraPremiumExemptions.useQuery(undefined, { refetchInterval: 15_000 });
  const [newGpt6ExemptEmail, setNewGpt6ExemptEmail] = useState("");
`;
code = code.replace(q1, '');

const m1 = `  const addGpt6ExemptionMutation = trpc.admin.setGpt6AstraPremiumExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.gpt6AstraPremiumExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(\`\${variables.email} now has GPT-6 Astra Premium Access\`);
      setNewGpt6ExemptEmail("");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeGpt6ExemptionMutation = trpc.admin.removeGpt6AstraPremiumExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.gpt6AstraPremiumExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(\`Revoked premium access for \${variables.email}\`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddGpt6Exemption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newGpt6ExemptEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    addGpt6ExemptionMutation.mutate({ email: trimmed });
  };
`;
code = code.replace(m1, '');

fs.writeFileSync('client/src/components/admin/controls/OperationalControls.tsx', code);
