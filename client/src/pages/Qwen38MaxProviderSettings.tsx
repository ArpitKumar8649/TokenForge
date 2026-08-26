import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Qwen38MaxProviderBalancerPanel } from "./AdminDashboard";

export default function Qwen38MaxProviderSettings() {
  const { user, loading } = useAuth();
  const isAdminSession = user?.isAdminSession === true;
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: isAdminSession, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const metrics = overview.data?.managedProviderKeyMetrics.find(item => item.modelId === "qwen3.8-max");

  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="dashboard-kicker">Provider settings</p><h1 className="dashboard-title">Qwen 3.8 Max</h1><p className="dashboard-subtitle">Equal-share routing across named server-only provider groups and per-key health-aware failover.</p></div><Button variant="outline" asChild className="border-white/12 text-[#d9d8e1] hover:bg-white/10"><a href="/admin"><ArrowLeft size={15} /> Back to provider settings</a></Button></div>{loading ? <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" /></div> : !isAdminSession ? <section className="dashboard-card grid min-h-64 place-items-center p-6 text-center"><div><ShieldAlert className="mx-auto text-[#f0c180]" size={24} /><p className="mt-3 text-sm font-semibold text-white">Administrator access required</p><p className="mt-2 max-w-sm text-xs leading-5 text-[#9091a3]">Open the control plane and unlock the administrator session before changing provider settings.</p><Button asChild size="sm" variant="outline" className="mt-4 border-white/12 text-[#e2e1ea] hover:bg-white/10"><a href="/admin">Open control plane</a></Button></div></section> : <Qwen38MaxProviderBalancerPanel metrics={metrics as never} />}</div></div></DashboardLayout>;
}
