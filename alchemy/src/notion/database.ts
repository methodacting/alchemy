import type {
  CreateDatabaseParameters,
  UpdateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";
import { isPage, type Page } from "./page.ts";

export interface DatabaseProps extends NotionApiOptions {
  /**
   * The parent page ID or Page resource
   */
  parent: string | Page;

  /**
   * Title of the database
   */
  title: CreateDatabaseParameters["title"];

  /**
   * Property schema for the database
   */
  properties: CreateDatabaseParameters["properties"];

  /**
   * Whether to adopt an existing database by ID
   * @default false
   */
  adopt?: boolean;
}

export type Database = Omit<DatabaseProps, "adopt" | "token" | "parent"> & {
  id: string;
  parentId: string;
  url: string;
  type: "notion::Database";
};

/**
 * Creates a Notion Database.
 *
 * @example
 * const db = await Database("tasks", {
 *   parent: "PAGE_ID",
 *   title: [{ text: { content: "My Tasks" } }],
 *   properties: {
 *     "Name": { title: {} },
 *     "Status": { select: { options: [{ name: "Todo" }, { name: "Done" }] } }
 *   }
 * });
 */
export const Database = Resource(
  "notion::Database",
  async function (
    this: Context<Database>,
    id: string,
    props: DatabaseProps
  ): Promise<Database> {
    const notion = createNotionClient(props);
    const parentId = isPage(props.parent) ? props.parent.id : props.parent.toString();

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          // In Notion, you "delete" a database by archiving its block
          await notion.blocks.delete({ block_id: this.output.id });
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.status?.toString().includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let databaseId = this.output?.id;
    let databaseData: any;

    if (this.phase === "create" || !databaseId) {
      if (props.adopt && !this.isReplacement) {
        // Notion IDs are usually passed directly as the resource ID or in props
        try {
          databaseData = await notion.databases.retrieve({ database_id: id });
          databaseId = databaseData.id;
        } catch (e) {
           // If id isn't a valid database id, we might need a search fallback
           // but Notion search is fuzzy. For now, we assume ID is provided for adoption.
        }
      }

      if (!databaseId || this.isReplacement) {
        const response = await notion.databases.create({
          parent: { page_id: parentId },
          title: props.title,
          properties: props.properties,
        } as CreateDatabaseParameters);
        databaseData = response;
        databaseId = databaseData.id;
      }
    } else {
      // Update mutable properties (title, properties)
      // Note: properties update in Notion is additive/modifying
      const response = await notion.databases.update({
        database_id: databaseId,
        title: props.title,
        properties: props.properties as UpdateDatabaseParameters["properties"],
      });
      databaseData = response;
    }

    return {
      id: databaseId,
      parentId,
      title: props.title,
      properties: props.properties,
      url: databaseData.url,
      type: "notion::Database",
    };
  }
);

/**
 * Type guard for Database resource
 */
export function isDatabase(resource: any): resource is Database {
  return resource?.[ResourceKind] === "notion::Database";
}
