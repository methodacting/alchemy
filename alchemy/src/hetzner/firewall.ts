import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isServer, type Server } from "./server.ts";
import type { HetznerFirewallRule, HetznerFirewallResource } from "./types.ts";
import { withExponentialBackoff } from "../util/retry.ts";

/**
 * Target for applying a firewall.
 * Can be a server ID, a Server resource, or a label selector object.
 */
export type FirewallApplyTo =
  | string
  | number
  | Server
  | { labelSelector: string };

export interface FirewallProps extends HetznerApiOptions {
  /**
   * Name of the firewall
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * List of rules for this firewall
   */
  rules?: HetznerFirewallRule[];

  /**
   * Resources the firewall should be applied to
   */
  applyTo?: FirewallApplyTo[];

  /**
   * User labels
   */
  labels?: Record<string, string>;

  /**
   * Whether to adopt an existing resource
   * @default false
   */
  adopt?: boolean;
}

export type Firewall = Omit<FirewallProps, "adopt" | "token" | "applyTo"> & {
  id: string;
  name: string;
  rules: HetznerFirewallRule[];
  /** Normalized applyTo resources as returned by the API */
  appliedTo: HetznerFirewallResource[];
  created: string;
  type: "hetzner::Firewall";
};

/**
 * Creates a Hetzner Cloud Firewall.
 *
 * @example
 * const fw = await Firewall("web-sec", {
 *   rules: [
 *     { direction: "in", protocol: "tcp", port: "80", source_ips: ["0.0.0.0/0", "::/0"] },
 *     { direction: "in", protocol: "tcp", port: "443", source_ips: ["0.0.0.0/0", "::/0"] },
 *     { direction: "in", protocol: "tcp", port: "22", source_ips: ["1.2.3.4/32"] }
 *   ]
 * });
 */
export const Firewall = Resource(
  "hetzner::Firewall",
  async function (
    this: Context<Firewall>,
    id: string,
    props: FirewallProps
  ): Promise<Firewall> {
    const api = createHetznerApi(props);
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          // Remove from all resources first
          if (this.output.appliedTo && this.output.appliedTo.length > 0) {
             try {
               await api.post(`/firewalls/${this.output.id}/actions/remove_from_resources`, {
                 remove_from: this.output.appliedTo
               });
               // Wait for removal
               await withExponentialBackoff(
                 async () => {
                    const { firewall } = await api.get<{ firewall: any }>(`/firewalls/${this.output!.id}`);
                    if (firewall.applied_to.length > 0) {
                        throw new Error("Firewall still applied to resources");
                    }
                 },
                 () => true,
                 10,
                 1000
               );
             } catch (e) {
               // ignore if already removed or firewall not found
             }
          }

          // Delete with retry
          await withExponentialBackoff(
            async () => {
                await api.delete(`/firewalls/${this.output!.id}`);
            },
            (error) => error.message?.includes("still in use"),
            10,
            2000
          );
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let firewallId = this.output?.id;
    let firewallData: any;

    // Normalize applyTo to API format
    const targetResources: HetznerFirewallResource[] = (props.applyTo ?? []).map(target => {
      if (typeof target === "string" || typeof target === "number") {
        return { type: "server", server: { id: parseInt(target.toString()) } };
      }
      if (isServer(target)) {
        return { type: "server", server: { id: parseInt(target.id) } };
      }
      return { type: "label_selector", label_selector: { selector: target.labelSelector } };
    });

    if (this.phase === "create" || !firewallId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { firewalls } = await api.get<{ firewalls: any[] }>(`/firewalls?name=${name}`);
          if (firewalls.length > 0) {
            firewallId = firewalls[0].id;
            firewallData = firewalls[0];
          }
        } catch (e) {
          // ignore
        }
      }

      if (!firewallId || this.isReplacement) {
        const response = await api.post<{ firewall: any; actions?: any[] }>(
          "/firewalls",
          {
            name,
            rules: props.rules,
            labels: props.labels,
          }
        );
        firewallData = response.firewall;
        firewallId = firewallData.id;

        // Apply to resources separately with retry to handle propagation delay
        if (targetResources.length > 0) {
            await withExponentialBackoff(
                async () => {
                    await api.post(`/firewalls/${firewallId}/actions/apply_to_resources`, {
                        apply_to: targetResources
                    });
                },
                (error) => {
                    return error.message?.includes("no public network interfaces found");
                },
                10,
                2000
            );
        }
      }
    } else {
      // Update mutable properties (name, labels)
      if (props.name !== this.output.name || JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)) {
        const response = await api.put<{ firewall: any }>(`/firewalls/${firewallId}`, {
          name,
          labels: props.labels,
        });
        firewallData = response.firewall;
      }

      // Update rules if changed
      if (JSON.stringify(props.rules) !== JSON.stringify(this.output.rules)) {
        await api.post(`/firewalls/${firewallId}/actions/set_rules`, {
          rules: props.rules ?? []
        });
      }

      // Update attachments if changed
      const currentTargetsStr = JSON.stringify(this.output.appliedTo);
      const newTargetsStr = JSON.stringify(targetResources);
      
      if (currentTargetsStr !== newTargetsStr) {
         // Standard set pattern: apply_to_resources (Hetzner handles the sync usually or requires explicit add/remove)
         // Actually the 'set_rules' action exists, but for resources we use 'apply_to_resources' and 'remove_from_resources'
         // To make it declarative, we should calculate diff or just use the sync action if it exists.
         // Looking at docs, there is no single "set_resources" action.
         
         // Calculate diff
         const toRemove = this.output.appliedTo.filter(curr => 
            !targetResources.some(next => JSON.stringify(next) === JSON.stringify(curr))
         );
         const toAdd = targetResources.filter(next => 
            !this.output.appliedTo.some(curr => JSON.stringify(curr) === JSON.stringify(next))
         );

         if (toRemove.length > 0) {
            await api.post(`/firewalls/${firewallId}/actions/remove_from_resources`, {
                remove_from: toRemove
            });
         }
         if (toAdd.length > 0) {
            await withExponentialBackoff(
                async () => {
                    await api.post(`/firewalls/${firewallId}/actions/apply_to_resources`, {
                        apply_to: toAdd
                    });
                },
                (error) => {
                    // Retry if no public interfaces yet (propagation delay)
                    return error.message?.includes("no public network interfaces found");
                },
                10, // max attempts
                2000 // 2s initial delay
            );
         }
      }

      // Final fetch to get current state
      const response = await api.get<{ firewall: any }>(`/firewalls/${firewallId}`);
      firewallData = response.firewall;
    }

    return {
      id: firewallData.id.toString(),
      name: firewallData.name,
      rules: firewallData.rules,
      appliedTo: firewallData.applied_to,
      labels: firewallData.labels,
      created: firewallData.created,
      type: "hetzner::Firewall",
    };
  }
);

/**
 * Type guard for Firewall resource
 */
export function isFirewall(resource: any): resource is Firewall {
  return resource?.[ResourceKind] === "hetzner::Firewall";
}
