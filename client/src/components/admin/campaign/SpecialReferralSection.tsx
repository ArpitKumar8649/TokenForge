import React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, UsersRound, WalletCards, Gauge } from "lucide-react";
import { SpecialReferralCampaignData } from "../types";
import { SectionHeader, Metric } from "../common/AdminCommon";

export function SpecialReferralCampaignSection({
  campaign,
  loading,
}: {
  campaign?: SpecialReferralCampaignData;
  loading: boolean;
}) {
  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<UsersRound size={17} />}
        title="Special referral campaign"
        detail="A capped $150 verified-member bonus. Slots are reserved at sign-up and awarded once only after the existing Discord membership verification succeeds."
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          icon={<UsersRound size={15} />}
          label="Reserved slots"
          value={`${campaign?.reserved ?? 0}/${campaign?.cap ?? 150}`}
          detail="New accounts attributed to this link"
          lime
        />
        <Metric
          icon={<WalletCards size={15} />}
          label="Verified gifts awarded"
          value={(campaign?.awarded ?? 0).toLocaleString()}
          detail="$150 credit settled after Discord verification"
          lime
        />
        <Metric
          icon={<Gauge size={15} />}
          label="Slots remaining"
          value={(campaign?.remaining ?? 150).toLocaleString()}
          detail="No further reservations after the cap"
        />
      </div>
      <div className="mt-5 rounded-xl border border-[#c9ff73]/15 bg-[#c9ff73]/[.045] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#c9ff73]">
          Shareable campaign link
        </p>
        <Input
          readOnly
          value={campaign?.link ?? "Loading…"}
          className="mt-2 border-[#c9ff73]/20 bg-black/20 font-mono text-xs text-[#e7eadf]"
          aria-label="Special referral campaign link"
        />
        <p className="mt-2 text-[10px] leading-5 text-[#9ca596]">
          Each qualifying account keeps its normal $50 sign-up credit and receives this separate $150 bonus only after Discord verification.
        </p>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-white/8 bg-black/10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-white/8 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#858697]">
          <span>Qualifying account</span>
          <span>Slot</span>
          <span>Gift status</span>
        </div>
        {loading ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
          </div>
        ) : campaign?.accounts.length ? (
          campaign.accounts.map((account) => (
            <div
              key={account.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-white/6 px-4 py-3 text-xs last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{account.name || "Unnamed account"}</p>
                <p className="mt-1 truncate text-[10px] text-[#858697]">{account.email || `Account #${account.id}`}</p>
              </div>
              <span className="font-mono text-[#d8d9e3]">#{account.slotNumber}</span>
              <Badge
                className={`border-0 text-[10px] ${
                  account.awardedAt ? "bg-[#f4bc4e]/15 text-[#ffe199]" : "bg-[#f0c180]/10 text-[#f0c180]"
                }`}
              >
                {account.awardedAt ? "$150 credited" : "Awaiting verification"}
              </Badge>
            </div>
          ))
        ) : (
          <p className="px-4 py-10 text-center text-xs text-[#858697]">
            No accounts have reserved a special referral slot yet.
          </p>
        )}
      </div>
    </section>
  );
}
