import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";

export interface SSHKeyProps extends HetznerApiOptions {
  /**
   * Name of the SSH key
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Public key string (e.g. "ssh-rsa ...")
   * Immutable: Changing this triggers replacement.
   */
  publicKey: string;

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

export type SSHKey = Omit<SSHKeyProps, "adopt" | "token"> & {
  id: string;
  name: string;
  fingerprint: string;
  created: string;
  type: "hetzner::SSHKey";
};

/**
 * Creates a Hetzner Cloud SSH Key.
 *
 * @example
 * const key = await SSHKey("my-key", {
 *   publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
 * });
 */
export const SSHKey = Resource(
  "hetzner::SSHKey",
  async function (
    this: Context<SSHKey>,
    id: string,
    props: SSHKeyProps,
  ): Promise<SSHKey> {
    const api = createHetznerApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/ssh_keys/${this.output.id}`);
        } catch (error: any) {
          if (
            !error.message?.includes("404") &&
            !error.message?.includes("not found")
          ) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.publicKey !== props.publicKey) {
        return this.replace(true);
      }
    }

    let keyId = this.output?.id;
    let keyData: any;

    if (this.phase === "create" || !keyId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { ssh_keys } = await api.get<{ ssh_keys: any[] }>(
            `/ssh_keys?name=${name}`,
          );
          if (ssh_keys.length > 0) {
            keyId = ssh_keys[0].id;
            keyData = ssh_keys[0];
          }
        } catch (e) {
          // ignore
        }
      }

      if (!keyId || this.isReplacement) {
        const response = await api.post<{ ssh_key: any }>("/ssh_keys", {
          name,
          public_key: props.publicKey,
          labels: props.labels,
        });
        keyData = response.ssh_key;
        keyId = keyData.id;
      }
    } else {
      // Update mutable properties (name, labels)
      if (
        props.name !== this.output.name ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ ssh_key: any }>(`/ssh_keys/${keyId}`, {
          name,
          labels: props.labels,
        });
        keyData = response.ssh_key;
      } else {
        const response = await api.get<{ ssh_key: any }>(`/ssh_keys/${keyId}`);
        keyData = response.ssh_key;
      }
    }

    return {
      id: keyData.id.toString(),
      name: keyData.name,
      publicKey: keyData.public_key,
      fingerprint: keyData.fingerprint,
      labels: keyData.labels,
      created: keyData.created,
      type: "hetzner::SSHKey",
    };
  },
);

/**
 * Type guard for SSHKey resource
 */
export function isSSHKey(resource: unknown): resource is SSHKey {
  return (resource as any)?.[ResourceKind] === "hetzner::SSHKey";
}
