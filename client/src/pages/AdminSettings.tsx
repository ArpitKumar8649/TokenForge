import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Save, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function parseEntries(value: string) {
  return value.split(/[\n,]/).map(entry => entry.trim()).filter(Boolean);
}

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const config = trpc.admin.emailAllowlist.useQuery(undefined, { enabled: user?.role === "admin" });
  const [value, setValue] = useState("");
  useEffect(() => {
    if (config.data) setValue(config.data.entries.join("\n"));
  }, [config.data?.updatedAt, config.data?.source]);
  const save = trpc.admin.setEmailAllowlist.useMutation({
    onSuccess: data => {
      utils.admin.emailAllowlist.setData(undefined, { ...data, source: "database" });
      setValue(data.entries.join("\n"));
      toast.success(data.entries.length ? "Email allowlist saved" : "Permanent email sign-up is open");
    },
    onError: error => toast.error(error.message),
  });
  const body = loading ? <div className="grid h-80 place-items-center"><Loader2 className="animate-spin text-[#b89aff]" /></div>
    : user?.role !== "admin" ? <div className="grid h-80 place-items-center rounded-2xl border border-white/10 bg-[#15161f] text-center"><ShieldAlert className="text-[#f0c180]" /><div><p className="mt-3 text-sm font-bold">Administrator access required</p><p className="mt-1 text-xs text-[#9293a4]">Only TokenForge administrators can change sign-up policy.</p></div></div>
      : config.isLoading ? <div className="grid h-80 place-items-center rounded-2xl border border-white/10 bg-[#15161f]"><Loader2 className="animate-spin text-[#b89aff]" /></div>
        : <section className="max-w-3xl rounded-2xl border border-white/10 bg-[#15161f] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><UsersRound size={17} className="text-[#b89aff]" /><p className="text-sm font-bold">Email access policy</p></div><p className="mt-2 max-w-xl text-xs leading-5 text-[#9495a7]">Add one domain or exact address per line. When this list has entries, only matching addresses may register or sign in. Leave it empty to accept permanent email addresses while keeping disposable providers blocked.</p></div><Badge className="w-fit border-0 bg-[#b89aff]/10 text-[#d6caff]">{config.data?.source === "database" ? "Admin managed" : "Environment default"}</Badge></div><Textarea value={value} onChange={event => setValue(event.target.value)} aria-label="Email allowlist entries" placeholder={"company.com\napproved@example.com"} className="mt-6 min-h-56 border-white/10 bg-black/15 font-mono text-sm leading-6" /><div className="mt-3 flex flex-col gap-3 text-xs text-[#9495a7] sm:flex-row sm:items-center sm:justify-between"><span>{parseEntries(value).length} entries · domains match every mailbox on that domain.</span><Button disabled={save.isPending} onClick={() => save.mutate({ entries: parseEntries(value) })} className="gap-2 bg-[#b89aff] text-[#1b1728] hover:bg-[#cfbcff]"><Save size={15} />{save.isPending ? "Saving…" : "Save access policy"}</Button></div><div className="mt-7 rounded-xl border border-white/8 bg-white/[.025] p-4 text-xs leading-5 text-[#b9bac8]"><strong className="text-white">Safety note.</strong> Disposable and throwaway domains remain blocked even if entered here. Keep at least one administrator address in the list before turning on a restrictive policy.</div></section>;
  return <DashboardLayout><div className="min-h-screen bg-[#0d0e14] p-3 text-white sm:p-7"><div className="mx-auto max-w-6xl"><div className="mb-7"><p className="dashboard-kicker">Operations console</p><h1 className="dashboard-title">Configuration</h1><p className="dashboard-subtitle">Control who may access TokenForge with first-party email and password sign-in.</p></div>{body}</div></div></DashboardLayout>;
}
