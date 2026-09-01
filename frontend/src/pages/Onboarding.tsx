import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import ConnectCanvasForm from "../components/ConnectCanvasForm";
import ConnectPlatformButton from "../components/ConnectPlatformButton";
import ReminderSettings from "../components/ReminderSettings";
import { parseApiDate } from "../lib/date";

export default function Onboarding() {
  const queryClient = useQueryClient();
  const integrationsQuery = useQuery({ queryKey: ["integrations"], queryFn: api.listIntegrations });
  const disconnect = useMutation({
    mutationFn: (id: number) => api.disconnectIntegration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const syncNow = useMutation({
    mutationFn: api.syncNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return (
    <div className="max-w-xl space-y-8">
      <section>
        <h1 className="text-lg font-semibold text-slate-800">Connect your accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          ManaPeer syncs assignments automatically in the background (every 15 minutes), or
          hit "Sync now" any time.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-800 mb-3">Canvas</h2>
        <ConnectCanvasForm />
      </section>

      <ConnectPlatformButton
        platform="gradescope"
        title="Gradescope"
        description="Your school routes Gradescope through SSO, so ManaPeer opens a real browser window for you to log in once (including any Duo prompt). It reuses that session afterward for periodic syncs."
        startLogin={api.startGradescopeLogin}
      />

      <ConnectPlatformButton
        platform="prairielearn"
        title="PrairieLearn"
        description="Same approach as Gradescope: a real browser window opens for you to log in once through your school's SSO, then ManaPeer reuses that session for periodic syncs."
        startLogin={api.startPrairieLearnLogin}
      />

      <ReminderSettings />

      <section>
        <h2 className="font-medium text-slate-800 mb-2">Connected integrations</h2>
        <div className="space-y-2">
          {integrationsQuery.data?.length === 0 && (
            <p className="text-sm text-slate-400">Nothing connected yet.</p>
          )}
          {integrationsQuery.data?.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium capitalize">{integration.type}</p>
                <p className="text-xs text-slate-500">
                  {integration.status === "connected" && integration.last_synced_at
                    ? `Last synced ${parseApiDate(integration.last_synced_at).toLocaleString()}`
                    : integration.status}
                </p>
                {integration.last_error && (
                  <p className="text-xs text-red-600">{integration.last_error}</p>
                )}
              </div>
              <button
                onClick={() => disconnect.mutate(integration.id)}
                className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => syncNow.mutate()}
          disabled={syncNow.isPending}
          className="mt-4 text-sm px-3 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {syncNow.isPending ? "Syncing…" : "Sync now"}
        </button>
        {syncNow.data && (
          <p className="mt-2 text-xs text-slate-500">
            Synced {syncNow.data.integrations_synced} integration(s),{" "}
            {syncNow.data.tasks_upserted} task(s).
            {syncNow.data.tasks_auto_dismissed > 0 &&
              ` Auto-dismissed ${syncNow.data.tasks_auto_dismissed} task(s) over 3 months past due.`}
          </p>
        )}
      </section>
    </div>
  );
}
