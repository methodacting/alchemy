import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isSSHKey, type SSHKey } from "./ssh-key.ts";
import type { HetznerLocation, HetznerStorageBoxAccessSettings, HetznerStorageBoxType } from "./types.ts";
import { poll } from "../util/poll.ts";

export interface StorageBoxProps extends HetznerApiOptions {
  /**
   * Name of the storage box
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Location (e.g. "fsn1", "nbg1")
   * Immutable: Changing this triggers replacement.
   */
  location: HetznerLocation;

  /**
   * Storage box type (e.g. "bx11", "bx21")
   */
  storageBoxType: HetznerStorageBoxType;

  /**
   * Initial password for the storage box
   * Required for creation.
   */
  password: string | Secret;

  /**
   * Access settings for the storage box
   */
  accessSettings?: HetznerStorageBoxAccessSettings;

  /**
   * SSH keys to inject into the storage box
   */
  sshKeys?: Array<string | number | SSHKey>;

  /**
   * User labels
   */
  labels?: Record<string, string>;

  /**
   * Whether to adopt an existing resource
   * @default false
   */
  adopt?: boolean;

  /**
   * Whether to delete the storage box when removed from Alchemy
   * @default true
   */
  delete?: boolean;
}

export type StorageBox = Omit<StorageBoxProps, "adopt" | "token" | "password" | "sshKeys" | "delete"> & {
  id: string;
  username: string;
  server: string;
  password: Secret;
  status: string;
  created: string;
  type: "hetzner::StorageBox";
};

/**
 * Creates a Hetzner Cloud Storage Box.
 *
 * @example
 * const box = await StorageBox("backup", {
 *   location: "fsn1",
 *   storageBoxType: "bx11",
 *   password: alchemy.secret("StrongPassword123!")
 * });
 */
export const StorageBox = Resource(
  "hetzner::StorageBox",
  async function (
    this: Context<StorageBox>,
    id: string,
    props: StorageBoxProps
  ): Promise<StorageBox> {
    const api = createHetznerApi(props, "robot");
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          await api.delete(`/storage_boxes/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.location !== props.location) {
        return this.replace(true);
      }
    }

    let boxId = this.output?.id;
    let boxData: any;

    const normalizedSshKeys: number[] = (props.sshKeys ?? []).map(key => {
      if (typeof key === "string" || typeof key === "number") return parseInt(key.toString());
      if (isSSHKey(key)) return parseInt(key.id);
      return 0;
    }).filter(id => id > 0);

    if (this.phase === "create" || !boxId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { storage_boxes } = await api.get<{ storage_boxes: any[] }>(`/storage_boxes?name=${name}`);
          if (storage_boxes.length > 0) {
            boxId = storage_boxes[0].id;
            boxData = storage_boxes[0];
          }
        } catch (e) { /* ignore */ }
      }

      if (!boxId || this.isReplacement) {
        const payload: any = {
          name,
          location: props.location,
          storage_box_type: props.storageBoxType,
          password: Secret.unwrap(props.password),
          access_settings: props.accessSettings,
          labels: props.labels,
          ssh_keys: normalizedSshKeys,
        };

        const response = await api.post<{ storage_box: any; action?: any }>(
          "/storage_boxes",
          payload
        );
        boxData = response.storage_box;
        boxId = boxData.id;

        if (response.action) {
            await poll({
                description: `storage box ${boxId} creation`,
                fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
                predicate: (res) => res.action.status === "success",
                initialDelay: 2000,
                maxDelay: 10000,
                timeout: 120000
            });
        }
        
        const freshResponse = await api.get<{ storage_box: any }>(`/storage_boxes/${boxId}`);
        boxData = freshResponse.storage_box;
      }
    } else {
      // Update mutable properties (name, labels)
      if (props.name !== this.output.name || JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)) {
        const response = await api.put<{ storage_box: any }>(`/storage_boxes/${boxId}`, {
          name,
          labels: props.labels,
        });
        boxData = response.storage_box;
      }

      // Sync storage_box_type
      if (props.storageBoxType !== this.output.storageBoxType) {
        const response = await api.post<{ action: any }>(`/storage_boxes/${boxId}/actions/change_type`, {
          storage_box_type: props.storageBoxType
        });
        await poll({
            description: `storage box ${boxId} type change`,
            fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
            predicate: (res) => res.action.status === "success",
            initialDelay: 2000,
            maxDelay: 10000,
            timeout: 300000 // Resizing can be slow
        });
      }

      // Sync access_settings
      if (JSON.stringify(props.accessSettings) !== JSON.stringify(this.output.accessSettings)) {
        const response = await api.post<{ action: any }>(`/storage_boxes/${boxId}/actions/update_access_settings`, props.accessSettings);
        await poll({
            description: `storage box ${boxId} access settings update`,
            fn: () => api.get<{ action: any }>(`/storage_boxes/actions/${response.action.id}`),
            predicate: (res) => res.action.status === "success",
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000
        });
      }

      // Fetch updated data
      const response = await api.get<{ storage_box: any }>(`/storage_boxes/${boxId}`);
      boxData = response.storage_box;
    }

    if (!boxData && boxId) {
        const response = await api.get<{ storage_box: any }>(`/storage_boxes/${boxId}`);
        boxData = response.storage_box;
    }

    return {
      id: boxData.id.toString(),
      name: boxData.name,
      location: boxData.location.name,
      storageBoxType: boxData.storage_box_type.name,
      accessSettings: boxData.access_settings,
      username: boxData.username,
      server: boxData.server,
      password: Secret.wrap(props.password),
      status: boxData.status,
      labels: boxData.labels,
      created: boxData.created,
      type: "hetzner::StorageBox",
    };
  }
);

/**
 * Type guard for StorageBox resource
 */
export function isStorageBox(resource: any): resource is StorageBox {
  return resource?.[ResourceKind] === "hetzner::StorageBox";
}
