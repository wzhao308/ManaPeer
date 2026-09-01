import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Integration } from "../api/client";
import { parseApiDate } from "../lib/date";

interface ConnectPlatformButtonProps {
  platform: string; // matches Integration.type, e.g. "gradescope" | "prairielearn"
  title: string;
  description: string;
  startLogin: () => Promise<Integration>;
}

/** Shared by every platform that connects via a one-time interactive browser
 * login (Gradescope, PrairieLearn) - same polling-while-connecting pattern,
 * same status/error display, differing only in which endpoint it calls. */
export default function ConnectPlatformButton({
  platform,
  title,
  description,
  startLogin,
}: ConnectPlatformButtonProps) {
  const queryClient = useQueryClient();

  // Shares the same cache entry as the "Connected integrations" list below, but
  // polls every 2s on its own while a login is in progress so the status here
  // updates live without the user refreshing anything.
  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
    refetchInterval: (query) =>
      query.state.data?.some((i) => i.type === platform && i.status === "connecting")
        ? 2000
        : false,
  });

  const startLoginMutation = useMutation({
    mutationFn: startLogin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const integration = integrationsQuery.data?.find((i) => i.type === platform);
  const connecting = integration?.status === "connecting";
  const connected = integration?.status === "connected";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-800 mb-1">{title}</h2>
      <p className="text-sm text-slate-500 mb-3">{description}</p>

      {connected && (
        <p className="text-sm text-emerald-600 mb-2">
          Connected
          {integration?.last_synced_at &&
            ` · last synced ${parseApiDate(integration.last_synced_at).toLocaleString()}`}
        </p>
      )}
      {connecting && (
        <p className="text-sm text-amber-600 mb-2">
          A Chromium window just opened — finish logging in there (including any Duo/school SSO
          prompt). This updates automatically once you're done.
        </p>
      )}
      {integration?.status === "error" && integration.last_error && (
        <p className="text-sm text-red-600 mb-2">{integration.last_error}</p>
      )}

      <button
        onClick={() => startLoginMutation.mutate()}
        disabled={connecting || startLoginMutation.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {connecting ? "Waiting for login…" : connected ? `Reconnect ${title}` : `Connect ${title}`}
      </button>
      {startLoginMutation.isError && (
        <p className="mt-2 text-sm text-red-600">{(startLoginMutation.error as Error).message}</p>
      )}
    </section>
  );
}
