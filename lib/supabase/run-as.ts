import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * A request-scoped stand-in for the cookie client.
 *
 * The AI connector (/api/mcp) arrives with a link rather than a session, so
 * there are no cookies for createClient() to read. Rather than give every
 * reader a second, service-role code path (which would have to re-implement
 * tenancy by hand, the one mistake that crosses studios), the connector signs
 * in AS the link's owner and runs the ordinary readers inside runAsUser. Every
 * createClient() call in that async scope returns the user's own client, so
 * RLS is the boundary exactly as it is in the app.
 *
 * AsyncLocalStorage, not a module variable: two requests on one warm instance
 * must never see each other's client.
 */
type Client = SupabaseClient<Database>;

const store = new AsyncLocalStorage<Client>();

export function runAsUser<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  return store.run(client, fn);
}

export function borrowedClient(): Client | undefined {
  return store.getStore();
}
