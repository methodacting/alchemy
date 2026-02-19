import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isStorageBox, type StorageBox } from "./storage-box.ts";
import type { HetznerStorageBoxAccessSettings } from "./types.ts";
import { poll } from "../util/poll.ts";

export interface StorageBoxSubaccountProps extends HetznerApiOptions {
  /**
   * The parent Storage Box
   */
  box: string | number | StorageBox;

  /**
   * Home directory for the subaccount (relative to the box root)
   */
  homeDirectory?: string;

  /**
   * Password for the subaccount
   */
  password: string | Secret;

  /**
   * Access settings for the subaccount
   */
  accessSettings?: HetznerStorageBoxAccessSettings;

  /**
   * Whether the subaccount is read-only
   * @default false
   */
  readOnly?: boolean;

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

export type StorageBoxSubaccount = Omit<StorageBoxSubaccountProps, "adopt" | "token" | "password" | "box"> & {
  id: string;
  boxId: string;
  username: string;
  server: string;
  type: "hetzner::StorageBoxSubaccount";
};

/**
 * Creates a Hetzner Cloud Storage Box Subaccount.
 *
 * @example
 * const sub = await StorageBoxSubaccount("app-user", {
 *   box: myStorageBox,
 *   homeDirectory: "app-data",
 *   password: alchemy.secret("StrongSubPassword123!"),
 *   accessSettings: {
 *     webdav_enabled: true
 *   }
 * });
 */
export const StorageBoxSubaccount = Resource(
  "hetzner::StorageBoxSubaccount",
  async function (
    this: Context<StorageBoxSubaccount>,
    id: string,
    props: StorageBoxSubaccountProps
  ): Promise<StorageBoxSubaccount> {
    const api = createHetznerApi(props, "robot");
    const boxId = isStorageBox(props.box) ? props.box.id : props.box.toString();

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/storage_boxes/${boxId}/subaccounts/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let subId = this.output?.id;
    let subData: any;

    if (this.phase === "create" || !subId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { subaccounts } = await api.get<{ subaccounts: any[] }>(`/storage_boxes/${boxId}/subaccounts`);
          // Note: Subaccounts don't have unique names in the same way, usually identified by ID or index.
          // We'll search for one with matching home directory or labels if possible.
          const existing = subaccounts.find(s => s.home_directory === props.homeDirectory);
          if (existing) {
            subId = existing.id;
            subData = existing;
          }
        } catch (e) { /* ignore */ }
      }

      if (!subId || this.isReplacement) {
        const payload: any = {
          home_directory: props.homeDirectory,
          password: Secret.unwrap(props.password),
          access_settings: props.accessSettings,
          read_only: props.readOnly,
          labels: props.labels,
        };

        const response = await api.post<{ subaccount: any; action?: any }>(
          `/storage_boxes/${boxId}/subaccounts`,
          payload
        );
        subData = response.subaccount;
        subId = subData.id;

        if (response.action) {
            await poll({
                description: `subaccount ${subId} creation`,
                fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
                predicate: (res) => res.action.status === "success",
                initialDelay: 1000,
                maxDelay: 5000,
                timeout: 60000
            });
        }
        
        // Fetch fresh subaccount data
        const freshResponse = await api.get<{ subaccount: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}`);
        subData = freshResponse.subaccount;
      }
    } else {
      // Update mutable properties
      if (
        props.readOnly !== this.output.readOnly ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ subaccount: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}`, {
          read_only: props.readOnly,
          labels: props.labels,
        });
        subData = response.subaccount;
      }

      // Sync home directory
      if (props.homeDirectory !== this.output.homeDirectory) {
        const response = await api.post<{ action: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}/actions/change_home_directory`, {
          home_directory: props.homeDirectory
        });
        await poll({
            description: `subaccount ${subId} home directory change`,
            fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
            predicate: (res) => res.action.status === "success",
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000
        });
      }

      // Sync access settings
      if (JSON.stringify(props.accessSettings) !== JSON.stringify(this.output.accessSettings)) {
        const response = await api.post<{ action: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}/actions/update_access_settings`, props.accessSettings);
        await poll({
            description: `subaccount ${subId} access settings update`,
            fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
            predicate: (res) => res.action.status === "success",
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000
        });
      }

      // Fetch fresh data
      const response = await api.get<{ subaccount: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}`);
      subData = response.subaccount;
    }

    if (!subData && subId) {
        const response = await api.get<{ subaccount: any }>(`/storage_boxes/${boxId}/subaccounts/${subId}`);
        subData = response.subaccount;
    }

    // Get parent box data for server info
    const { storage_box: boxData } = await api.get<{ storage_box: any }>(`/storage_boxes/${boxId}`);

    return {
      id: subData.id.toString(),
      boxId: boxId.toString(),
      username: subData.username,
      server: boxData.server, // Use parent server
      homeDirectory: subData.home_directory,
      accessSettings: subData.access_settings,
      readOnly: subData.read_only,
      labels: subData.labels,
      type: "hetzner::StorageBoxSubaccount",
    };
  }
);

/**
 * Type guard for StorageBoxSubaccount resource
 */
export function isStorageBoxSubaccount(resource: any): resource is StorageBoxSubaccount {
  return resource?.[ResourceKind] === "hetzner::StorageBoxSubaccount";
}
