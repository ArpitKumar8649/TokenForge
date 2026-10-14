import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gauge, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SectionHeader } from "../common/AdminCommon";

export function Gpt6PremiumControls() {
  const utils = trpc.useUtils();
  const exemptions = trpc.admin.gpt6AstraPremiumExemptions.useQuery(undefined, { refetchInterval: 15_000 });
  const [newExemptEmail, setNewExemptEmail] = useState("");

  const addExemptionMutation = trpc.admin.setGpt6AstraPremiumExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.gpt6AstraPremiumExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(`${variables.email} now has GPT-6 Astra Premium Access`);
      setNewExemptEmail("");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeExemptionMutation = trpc.admin.removeGpt6AstraPremiumExemption.useMutation({
    onSuccess: async (_data, variables) => {
      await Promise.all([
        utils.admin.gpt6AstraPremiumExemptions.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(`Revoked premium access for ${variables.email}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAddExemption = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newExemptEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    addExemptionMutation.mutate({ email: trimmed });
  };

  return (
    <div className="space-y-4">
      <section className="dashboard-card">
        <SectionHeader
          icon={<Gauge size={17} />}
          title="GPT-6 Astra Premium Access"
          description="Grant specific users free access to the GPT-6 Astra model without requiring a paid tier. This bypasses the 5-message free limit and grants API access."
        />
        <div className="p-4 sm:p-5">
          <form onSubmit={handleAddExemption} className="flex gap-2">
            <Input
              placeholder="user@example.com"
              value={newExemptEmail}
              onChange={(e) => setNewExemptEmail(e.target.value)}
              className="max-w-[300px] h-9 bg-white/5 border-white/10 placeholder:text-slate-500 text-sm"
              disabled={addExemptionMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!newExemptEmail.trim() || addExemptionMutation.isPending}
              className="h-9 bg-white/10 hover:bg-white/20 text-white"
            >
              {addExemptionMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4 mr-1" />}
              Grant Access
            </Button>
          </form>

          {exemptions.isLoading ? (
            <div className="mt-4 flex items-center justify-center py-6 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : exemptions.data?.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500 py-4 px-3 bg-white/5 rounded-lg border border-white/5">
              No users have been granted premium exemption yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Premium Exemptions</p>
              <div className="bg-black/20 border border-white/5 rounded-lg divide-y divide-white/5 overflow-hidden">
                {exemptions.data?.map((entry) => (
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
                      onClick={() => removeExemptionMutation.mutate({ email: entry.email })}
                      disabled={removeExemptionMutation.isPending}
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
      </section>
    </div>
  );
}
