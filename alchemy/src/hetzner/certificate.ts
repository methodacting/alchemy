import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import type { HetznerCertificateStatus, HetznerCertificateType } from "./types.ts";

export interface CertificateProps extends HetznerApiOptions {
  /**
   * Name of the certificate
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Type of the certificate
   */
  type: HetznerCertificateType;

  /**
   * PEM-encoded certificate (required for type "uploaded")
   */
  certificate?: string;

  /**
   * PEM-encoded private key (required for type "uploaded")
   */
  privateKey?: string | Secret;

  /**
   * Domain names for which the certificate should be issued (required for type "managed")
   */
  domainNames?: string[];

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

export type Certificate = Omit<CertificateProps, "adopt" | "token" | "privateKey" | "type"> & {
  id: string;
  name: string;
  certificateType: HetznerCertificateType;
  fingerprint: string;
  notValidBefore: string;
  notValidAfter: string;
  status?: HetznerCertificateStatus;
  created: string;
  type: "hetzner::Certificate";
};

/**
 * Creates a Hetzner Cloud Certificate.
 *
 * @example
 * // Managed certificate (Let's Encrypt)
 * const cert = await Certificate("managed-cert", {
 *   type: "managed",
 *   domainNames: ["example.com", "*.example.com"]
 * });
 *
 * @example
 * // Uploaded certificate
 * const cert = await Certificate("uploaded-cert", {
 *   type: "uploaded",
 *   certificate: "-----BEGIN CERTIFICATE-----...",
 *   privateKey: alchemy.secret("-----BEGIN PRIVATE KEY-----...")
 * });
 */
export const Certificate = Resource(
  "hetzner::Certificate",
  async function (
    this: Context<Certificate>,
    id: string,
    props: CertificateProps
  ): Promise<Certificate> {
    const api = createHetznerApi(props);
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/certificates/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      const typeChanged = this.output.type !== props.type;
      const domainsChanged = JSON.stringify(this.output.domainNames) !== JSON.stringify(props.domainNames);
      const certChanged = props.type === "uploaded" && props.certificate !== this.output.certificate;
      
      if (typeChanged || domainsChanged || certChanged) {
        return this.replace(true);
      }
    }

    let certId = this.output?.id;
    let certData: any;

    if (this.phase === "create" || !certId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { certificates } = await api.get<{ certificates: any[] }>(`/certificates?name=${name}`);
          if (certificates.length > 0) {
            certId = certificates[0].id;
            certData = certificates[0];
          }
        } catch (e) { /* ignore */ }
      }

      if (!certId || this.isReplacement) {
        const payload: any = {
          name,
          type: props.type,
          labels: props.labels,
        };

        if (props.type === "managed") {
          payload.domain_names = props.domainNames;
        } else {
          payload.certificate = props.certificate;
          payload.private_key = Secret.unwrap(props.privateKey);
        }

        const response = await api.post<{ certificate: any }>(
          "/certificates",
          payload
        );
        certData = response.certificate;
        certId = certData.id;
      }
    } else {
      // Update mutable properties (name, labels)
      if (props.name !== this.output.name || JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)) {
        const response = await api.put<{ certificate: any }>(`/certificates/${certId}`, {
          name,
          labels: props.labels,
        });
        certData = response.certificate;
      } else {
        const response = await api.get<{ certificate: any }>(`/certificates/${certId}`);
        certData = response.certificate;
      }
    }

    return {
      id: certData.id.toString(),
      name: certData.name,
      certificateType: certData.type,
      certificate: certData.certificate,
      domainNames: certData.domain_names,
      fingerprint: certData.fingerprint,
      notValidBefore: certData.not_valid_before,
      notValidAfter: certData.not_valid_after,
      status: certData.status,
      labels: certData.labels,
      created: certData.created,
      type: "hetzner::Certificate",
    };
  }
);

/**
 * Type guard for Certificate resource
 */
export function isCertificate(resource: any): resource is Certificate {
  return resource?.[ResourceKind] === "hetzner::Certificate";
}
