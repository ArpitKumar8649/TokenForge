import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Award, Check, Loader2, Sparkles, X, User } from "lucide-react";
import { toast } from "sonner";
import { UserTierBadge, USER_TIER_CONFIGS, UserTier } from "@/components/UserTierBadge";
import { SectionHeader } from "../common/AdminCommon";

const TIERS: UserTier[] = ["free", "starter", "pro", "max", "power", "ultra"];

export function UserTierAssignmentCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const searchResults = trpc.admin.searchUsersForTier.useQuery(
    { query: searchQuery.trim() },
    { staleTime: 5_000 }
  );

  const assignTierMutation = trpc.admin.assignUserTier.useMutation({
    onSuccess: (data) => {
      const config = USER_TIER_CONFIGS[data.tier as UserTier];
      toast.success(`Assigned ${config.label} to user #${data.userId}`);
      setPendingUserId(null);
      void utils.admin.searchUsersForTier.invalidate();
      void utils.admin.accounts.invalidate();
      void utils.admin.overview.invalidate();
    },
    onError: (error) => {
      setPendingUserId(null);
      toast.error(error.message || "Failed to assign user tier");
    },
  });

  const handleAssignTier = (userId: number, tier: UserTier) => {
    setPendingUserId(userId);
    assignTierMutation.mutate({ userId, tier });
  };

  const users = searchResults.data ?? [];

  return (
    <section className="dashboard-card border border-white/10 bg-[#09090b] p-5 sm:p-6 rounded-2xl">
      <SectionHeader
        icon={<Award size={18} className="text-[#c9ff73]" />}
        title="Assign User Tier & Dashboard Badge"
        detail="Search any developer by email or name to assign their tier. Tiers set their dashboard badge and govern frontier model permissions (Max, Power, and Ultra tiers unlock unlimited GPT-6 Astra)."
      />

      <div className="mt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-3 text-[#858697]" size={16} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email (e.g. developer@gmail.com) or name..."
            className="h-11 border-white/10 bg-black/30 pl-10 pr-10 text-sm placeholder:text-[#6f7082] focus:border-[#c9ff73]/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-3 text-[#858697] hover:text-white"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {searchResults.isLoading ? (
          <div className="flex items-center justify-center py-8 text-[#c9ff73]">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span className="text-xs text-[#8f90a2]">Searching accounts...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-white/6 bg-black/20 p-6 text-center">
            <User className="mx-auto text-[#6b6d80] mb-2" size={24} />
            <p className="text-xs font-medium text-[#c0c2d3]">
              {searchQuery.trim()
                ? `No accounts found matching "${searchQuery}".`
                : "Type an email or name above to find any user and assign their tier badge."}
            </p>
            <p className="text-[11px] text-[#717385] mt-1">
              All accounts default to Free Tier until upgraded or assigned.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#797b8e]">
              Found {users.length} {users.length === 1 ? "developer" : "developers"}:
            </p>
            {users.map((user) => {
              const currentTier = (user.tier as UserTier) || "free";
              const isUpdating = assignTierMutation.isPending && pendingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-white/15"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/6">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c9ff73]/10 font-bold text-sm text-[#c9ff73]">
                        {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">
                            {user.name || "TokenForge Developer"}
                          </p>
                          <span className="text-[11px] font-mono text-[#717385]">#{user.id}</span>
                        </div>
                        <p className="text-xs text-[#8f90a2] truncate">{user.email || "No email"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-[#717385]">
                        Current Tier:
                      </span>
                      <UserTierBadge tier={currentTier} showTag size="sm" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-[#a0a2b4] mb-2 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-[#c9ff73]" />
                      Assign Badge:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {TIERS.map((tierKey) => {
                        const config = USER_TIER_CONFIGS[tierKey];
                        const isSelected = currentTier === tierKey;
                        const TierIcon = config.icon;

                        return (
                          <button
                            key={tierKey}
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAssignTier(user.id, tierKey)}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isSelected
                                ? `${config.badgeClass} ring-2 ring-[#c9ff73]/60 shadow-md`
                                : "border-white/8 bg-black/30 hover:border-white/20 hover:bg-white/[0.04] text-[#b0b2c3]"
                            } ${isUpdating ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <TierIcon size={13} className={isSelected ? config.textClass : "text-[#7f8194]"} />
                              <span className={`text-xs font-semibold ${isSelected ? "text-white" : ""}`}>
                                {config.label}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase tracking-wider opacity-75 font-mono">
                              {isSelected ? (
                                <span className="text-[#c9ff73] font-bold flex items-center gap-0.5">
                                  <Check size={10} /> Active
                                </span>
                              ) : (
                                config.tag
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
