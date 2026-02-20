import type {
  CreateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";
import { isPage, type Page } from "./page.ts";

export interface DatabaseProps extends NotionApiOptions {
  /**
   * The parent page ID or Page resource
   */
  parent: string | Page;

  /**
   * Title of the database container
   */
  title: CreateDatabaseParameters["title"];

  /**
   * Optional icon for the database
   */
  icon?: CreateDatabaseParameters["icon"];

  /**
   * Optional cover for the database
   */
  cover?: CreateDatabaseParameters["cover"];

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
 * Creates a Notion Database Container.
 * In the 2025-09-03 API, a Database is an organizational container
 * that can house multiple Data Sources.
 *
 * @example
 * const db = await Database("project-hub", {
 *   parent: "PAGE_ID",
 *   title: [{ text: { content: "Project Hub" } }]
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
        try {
          databaseData = await notion.databases.retrieve({ database_id: id });
          databaseId = databaseData.id;
        } catch (e) { /* ignore */ }
      }

      if (!databaseId || this.isReplacement) {
        const response = await notion.databases.create({
          parent: { page_id: parentId },
          title: props.title,
          icon: props.icon,
          cover: props.cover,
        } as any); // Type cast due to possible SDK version lag
        databaseData = response;
        databaseId = databaseData.id;
      }
    } else {
      // Update mutable properties (title, icon, cover)
      const response = await notion.databases.update({
        database_id: databaseId,
        title: props.title,
        icon: props.icon,
        cover: props.cover,
      } as any);
      databaseData = response;
    }

    return {
      id: databaseId as string,
      parentId,
      title: props.title,
      icon: props.icon,
      cover: props.cover,
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
