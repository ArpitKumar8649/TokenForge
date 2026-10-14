import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Lock, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Toggle } from "../common/AdminCommon";
import { ManagedProviderKeyMetricGroup } from "../types";
import { Layers } from "lucide-react";
import {
  AllProviderKeyMetricsOverviewPanel,
  ClaudeFable5ProviderBalancerPanel,
  ClaudeOpus5ProviderBalancerPanelWrapper,
  DeepseekV4ProProviderBalancerPanel,
  Glm53ProviderSettingsPanel,
  Gpt6AstraProviderBalancerPanel,
  KimiK3ProviderBalancerPanel,
  Qwen38MaxProviderBalancerPanel,
  RenderNimProxySwarmPanel,
  Sonnet46ProviderBalancerPanel,
} from "./ProvidersSection";
import { OrcaRouterCredentialPanel } from "./OrcaRouterCredentialPanel";
import { UniversalModelProviderBalancer } from "./UniversalModelProviderBalancer";

export function PinnedUserRoutingPolicyCard() {
  const utils = trpc.useUtils();
  const policyQuery = trpc.admin.pinnedUserRoutingPolicy.useQuery();
  const setPolicy = trpc.admin.setPinnedUserRoutingPolicy.useMutation({
    onSuccess: (data) => {
      utils.admin.pinnedUserRoutingPolicy.setData(undefined, data);
      toast.success(
        data.softPreference
          ? "Dedicated user routing policy set to Soft Preference (Failover enabled)"
          : "Dedicated user routing policy set to Strict Lock (Other providers blacklisted)"
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const softPreference = policyQuery.data?.softPreference ?? true;

  return (
    <div className="dashboard-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">
              <Users size={15} />
            </span>
            <h3 className="text-sm font-semibold text-white">Dedicated User Routing Policy</h3>
            <Badge
              className={`border text-[10px] ${
                softPreference
                  ? "border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#c9ff73]"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-300"
              }`}
            >
              {softPreference ? "Soft Preference (Failover Enabled)" : "Strict Lock (Blacklist Others)"}
            </Badge>
          </div>
          <p className="text-xs text-[#8e90a2]">
            {softPreference
              ? "Requests from pinned users prioritize their assigned provider(s) first. If all pinned providers are offline or failing, traffic automatically fails over to general pool providers to prevent downtime."
              : "Strict isolation mode active: Pinned users are locked to their assigned provider(s) and all other providers are blacklisted for them. If their pinned providers fail, requests will not leak into the general pool."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-medium text-white">{softPreference ? "Soft Preference" : "Strict Lock"}</p>
            <p className="text-[10px] text-[#8e90a2]">{softPreference ? "Failover allowed" : "Strict isolation"}</p>
          </div>
          <Toggle
            label="Routing Policy Mode"
            enabled={softPreference}
            pending={setPolicy.isPending || policyQuery.isLoading}
            onChange={(enabled) => setPolicy.mutate({ softPreference: enabled })}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3 text-[11px] text-[#8e90a2]">
        <span className="flex items-center gap-1 text-[#c9ff73]">
          <ShieldCheck size={13} />
          <strong>Admin Account Email:</strong>
        </span>
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#c9ff73]">admin@gmail.com</code>
        <span className="text-[#6d6e7f]">·</span>
        <span>Pin <code className="rounded bg-black/40 px-1 py-0.2 font-mono text-[10px] text-white">admin@gmail.com</code> to any provider card below to immediately test dedicated routing.</span>
      </div>
    </div>
  );
}

export type ManagedProviderTabId =
  | "universal"
  | "opus"
  | "fable"
  | "sonnet46"
  | "deepseek-v4-pro"
  | "glm"
  | "qwen38max"
  | "gpt6astra"
  | "kimi"
  | "metrics"
  | "render-nim"
  | "orca";

export function ManagedProviderSelector({
  keyMetrics,
}: {
  keyMetrics: ManagedProviderKeyMetricGroup[];
}) {
  const [activeTab, setActiveTab] = useState<ManagedProviderTabId>("opus");

  const metricFor = (modelId: string) => keyMetrics.find((item) => item.modelId === modelId);

  return (
    <div className="space-y-4">
      <PinnedUserRoutingPolicyCard />

      <div className="dashboard-card flex flex-wrap gap-2 p-2">
        <Button
          size="sm"
          variant={activeTab === "universal" ? "default" : "ghost"}
          onClick={() => setActiveTab("universal")}
          className={
            activeTab === "universal"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91] font-semibold flex items-center gap-1.5"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white flex items-center gap-1.5"
          }
        >
          <Layers size={13} />
          Universal Model Hub
        </Button>
        <Button
          size="sm"
          variant={activeTab === "opus" ? "default" : "ghost"}
          onClick={() => setActiveTab("opus")}
          className={
            activeTab === "opus"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Claude Opus 5
        </Button>
        <Button
          size="sm"
          variant={activeTab === "fable" ? "default" : "ghost"}
          onClick={() => setActiveTab("fable")}
          className={
            activeTab === "fable"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Claude Fable 5.1
        </Button>
        <Button
          size="sm"
          variant={activeTab === "sonnet46" ? "default" : "ghost"}
          onClick={() => setActiveTab("sonnet46")}
          className={
            activeTab === "sonnet46"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Claude Sonnet 4.6
        </Button>
        <Button
          size="sm"
          variant={activeTab === "deepseek-v4-pro" ? "default" : "ghost"}
          onClick={() => setActiveTab("deepseek-v4-pro")}
          className={
            activeTab === "deepseek-v4-pro"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          DeepSeek V4 Pro
        </Button>
        <Button
          size="sm"
          variant={activeTab === "glm" ? "default" : "ghost"}
          onClick={() => setActiveTab("glm")}
          className={
            activeTab === "glm"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          GLM 5.3
        </Button>
        <Button
          size="sm"
          variant={activeTab === "qwen38max" ? "default" : "ghost"}
          onClick={() => setActiveTab("qwen38max")}
          className={
            activeTab === "qwen38max"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Qwen 3.8 Max
        </Button>
        <Button
          size="sm"
          variant={activeTab === "gpt6astra" ? "default" : "ghost"}
          onClick={() => setActiveTab("gpt6astra")}
          className={
            activeTab === "gpt6astra"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          GPT-6 Astra
        </Button>
        <Button
          size="sm"
          variant={activeTab === "kimi" ? "default" : "ghost"}
          onClick={() => setActiveTab("kimi")}
          className={
            activeTab === "kimi"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Kimi K3
        </Button>
        <Button
          size="sm"
          variant={activeTab === "metrics" ? "default" : "ghost"}
          onClick={() => setActiveTab("metrics")}
          className={
            activeTab === "metrics"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Provider & Key Metrics
        </Button>
        <Button
          size="sm"
          variant={activeTab === "render-nim" ? "default" : "ghost"}
          onClick={() => setActiveTab("render-nim")}
          className={
            activeTab === "render-nim"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          Proxy & Circuit
        </Button>
        <Button
          size="sm"
          variant={activeTab === "orca" ? "default" : "ghost"}
          onClick={() => setActiveTab("orca")}
          className={
            activeTab === "orca"
              ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
              : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"
          }
        >
          OrcaRouter pool
        </Button>
      </div>

      {activeTab === "universal" && (
        <UniversalModelProviderBalancer />
      )}
      {activeTab === "opus" && (
        <ClaudeOpus5ProviderBalancerPanelWrapper metrics={metricFor("claude-opus-5")} />
      )}
      {activeTab === "fable" && <ClaudeFable5ProviderBalancerPanel metrics={metricFor("claude-fable-5.1")} />}
      {activeTab === "sonnet46" && <Sonnet46ProviderBalancerPanel metrics={metricFor("claude-sonnet-4.6")} />}
      {activeTab === "deepseek-v4-pro" && (
        <DeepseekV4ProProviderBalancerPanel metrics={metricFor("deepseek-v4-pro")} />
      )}
      {activeTab === "glm" && <Glm53ProviderSettingsPanel metrics={metricFor("glm-5.3")} />}
      {activeTab === "qwen38max" && <Qwen38MaxProviderBalancerPanel metrics={metricFor("qwen3.8-max")} />}
      {activeTab === "gpt6astra" && <Gpt6AstraProviderBalancerPanel metrics={metricFor("gpt-6-astra")} />}
      {activeTab === "kimi" && <KimiK3ProviderBalancerPanel metrics={metricFor("kimi-k3")} />}
      {activeTab === "metrics" && <AllProviderKeyMetricsOverviewPanel keyMetrics={keyMetrics} />}
      {activeTab === "render-nim" && <RenderNimProxySwarmPanel />}
      {activeTab === "orca" && <OrcaRouterCredentialPanel />}
    </div>
  );
}
