import { Context } from "../context.ts";
import { Resource } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import type { HetznerLocation, HetznerVolumeFormat } from "./types.ts";
import { poll } from "../util/poll.ts";

export interface VolumeProps extends HetznerApiOptions {
  /**
   * Name of the volume
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Size of the volume in GB
   * Minimum: 10
   */
  size: number;

  /**
   * Location (e.g. "nbg1", "fsn1", "ash")
   * Immutable: Changing this triggers replacement.
   */
  location?: HetznerLocation;

  /**
   * Server ID to attach the volume to
   */
  server?: string;

  /**
   * Auto-mount the volume on the server
   */
  automount?: boolean;

  /**
   * Format the volume after creation
   * Immutable: Changing this triggers replacement.
   */
  format?: HetznerVolumeFormat;

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
   * Whether to delete the volume when removed from Alchemy
   * @default true
   */
  delete?: boolean;
}

export type Volume = Omit<VolumeProps, "adopt" | "token" | "delete"> & {
  id: string;
  name: string;
  status: string;
  linuxDevice: string;
  created: string;
  type: "hetzner::Volume";
};

/**
 * Creates a Hetzner Cloud Volume.
 *
 * @example
 * const volume = await Volume("db-data", {
 *   size: 20,
 *   location: "nbg1",
 *   format: "xfs"
 * });
 */
export const Volume = Resource(
  "hetzner::Volume",
  async function (
    this: Context<Volume>,
    id: string,
    props: VolumeProps
  ): Promise<Volume> {
    const api = createHetznerApi(props);
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          // Robust delete: keep trying to detach if delete fails due to attachment
          await poll({
             description: `volume ${this.output.id} delete`,
             fn: async () => {
                try {
                    await api.delete(`/volumes/${this.output.id}`);
                    return { success: true };
                } catch (e: any) {
                    if (e.message?.includes("404") || e.message?.includes("not found")) return { success: true };
                    if (e.message?.includes("attached")) {
                        // Try detaching on the fly
                        try {
                            await api.post(`/volumes/${this.output.id}/actions/detach`);
                        } catch (detachErr) {
                            // ignore if detach fails (might already be detaching)
                        }
                        return { success: false };
                    }
                    throw e;
                }
             },
             predicate: (res) => res.success === true,
             initialDelay: 1000,
             maxDelay: 5000,
             timeout: 120000 // 2 minutes for detachment + deletion
          });
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (
        this.output.location !== props.location ||
        this.output.format !== props.format
      ) {
        return this.replace(true);
      }
    }

    let volumeId = this.output?.id;
    let volumeData: any;

    if (this.phase === "create" || !volumeId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { volumes } = await api.get<{ volumes: any[] }>(`/volumes?name=${name}`);
          if (volumes.length > 0) {
            volumeId = volumes[0].id;
            volumeData = volumes[0];
          }
        } catch (e) {
          // ignore
        }
      }

      if (!volumeId || this.isReplacement) {
        const payload: any = {
          name,
          size: props.size,
          automount: props.automount,
          format: props.format,
          labels: props.labels,
        };
        
        if (props.server) payload.server = parseInt(props.server);
        if (props.location) payload.location = props.location;

        const response = await api.post<{ volume: any; action?: any }>(
          "/volumes",
          payload
        );
        volumeData = response.volume;
        volumeId = volumeData.id;
      }
    } else {
      if (props.name !== this.output.name || JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)) {
        const response = await api.put<{ volume: any }>(`/volumes/${volumeId}`, {
          name,
          labels: props.labels,
        });
        volumeData = response.volume;
      }

      if (props.size !== this.output.size) {
        if (props.size < this.output.size) {
          throw new Error(`Cannot decrease volume size from ${this.output.size}GB to ${props.size}GB. This operation is not supported by Hetzner.`);
        }
        await api.post(`/volumes/${volumeId}/actions/resize`, {
          size: props.size
        });
        
        // Wait for resize to reflect
        await poll({
            description: `volume ${volumeId} resize to ${props.size}GB`,
            fn: () => api.get<{ volume: any }>(`/volumes/${volumeId}`),
            predicate: (res) => res.volume.size === props.size,
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000
        });
        
        const response = await api.get<{ volume: any }>(`/volumes/${volumeId}`);
        volumeData = response.volume;
      }

      const currentServer = this.output.server ? this.output.server.toString() : undefined;
      const newServer = props.server ? props.server.toString() : undefined;

      if (currentServer !== newServer) {
        if (currentServer) {
          await api.post(`/volumes/${volumeId}/actions/detach`);
          await poll({
            description: `volume ${volumeId} detach from server ${currentServer}`,
            fn: () => api.get<{ volume: any }>(`/volumes/${volumeId}`),
            predicate: (res) => res.volume.server === null,
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000
          });
        }
        if (newServer) {
          await api.post(`/volumes/${volumeId}/actions/attach`, {
            server: parseInt(newServer),
            automount: props.automount
          });
          
          await poll({
            description: `volume ${volumeId} attachment to server ${newServer}`,
            fn: () => api.get<{ volume: any }>(`/volumes/${volumeId}`),
            predicate: (res) => {
                const serverId = res.volume.server?.id?.toString() ?? res.volume.server?.toString();
                return serverId === newServer;
            },
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000 // 1 minute
          });
        }
        const response = await api.get<{ volume: any }>(`/volumes/${volumeId}`);
        volumeData = response.volume;
      }
      
      if (!volumeData) {
         const response = await api.get<{ volume: any }>(`/volumes/${volumeId}`);
         volumeData = response.volume;
      }
    }

    return {
      id: volumeData.id.toString(),
      name: volumeData.name,
      size: volumeData.size,
      location: volumeData.location?.name,
      server: volumeData.server ? volumeData.server.toString() : undefined,
      status: volumeData.status,
      linuxDevice: volumeData.linux_device,
      format: volumeData.format,
      labels: volumeData.labels,
      automount: props.automount,
      created: volumeData.created,
      type: "hetzner::Volume",
    };
  }
);
