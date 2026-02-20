import type {
  CreatePageParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";
import { isDatabase, type Database } from "./database.ts";
import { isDataSource, type DataSource } from "./data-source.ts";

export interface PageProps extends NotionApiOptions {
  /**
   * The parent container (Page, Database, or Data Source)
   */
  parent: string | Page | Database | DataSource;

  /**
   * Properties for the page
   */
  properties: CreatePageParameters["properties"];

  /**
   * Page icon
   */
  icon?: CreatePageParameters["icon"];

  /**
   * Page cover
   */
  cover?: CreatePageParameters["cover"];

  /**
   * Page content (blocks)
   */
  children?: CreatePageParameters["children"];

  /**
   * Whether to adopt an existing page by ID
   * @default false
   */
  adopt?: boolean;
}

export type Page = Omit<PageProps, "adopt" | "token" | "parent"> & {
  id: string;
  parentId: string;
  parentType: "page_id" | "database_id" | "data_source_id";
  url: string;
  type: "notion::Page";
};

/**
 * Creates a Notion Page.
 *
 * @example
 * const page = await Page("my-doc", {
 *   parent: "PARENT_PAGE_ID",
 *   properties: {
 *     title: [{ text: { content: "My Documentation" } }]
 *   }
 * });
 */
export const Page = Resource(
  "notion::Page",
  async function (
    this: Context<Page>,
    id: string,
    props: PageProps
  ): Promise<Page> {
    const notion = createNotionClient(props);
    
    let parentId: string;
    let parentType: "page_id" | "database_id" | "data_source_id";

    if (isDataSource(props.parent)) {
      parentId = props.parent.id;
      parentType = "data_source_id";
    } else if (isDatabase(props.parent)) {
      parentId = props.parent.id;
      parentType = "database_id"; // Deprecated but still works? Better use Data Source.
    } else if (isPage(props.parent)) {
      parentId = props.parent.id;
      parentType = "page_id";
    } else {
      parentId = props.parent.toString();
      parentType = "page_id"; 
    }

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

    let pageId = this.output?.id;
    let pageData: any;

    if (this.phase === "create" || !pageId) {
      if (props.adopt && !this.isReplacement) {
        try {
          pageData = await notion.pages.retrieve({ page_id: id });
          pageId = pageData.id;
        } catch (e) { /* ignore */ }
      }

      if (!pageId || this.isReplacement) {
        const payload: any = {
          parent: { type: parentType, [parentType]: parentId },
          properties: props.properties,
          icon: props.icon,
          cover: props.cover,
          children: props.children,
        };

        const response = await notion.pages.create(payload as CreatePageParameters);
        pageData = response;
        pageId = pageData.id;
      }
    } else {
      // Update mutable properties
      const response = await notion.pages.update({
        page_id: pageId,
        properties: props.properties as UpdatePageParameters["properties"],
        icon: props.icon,
        cover: props.cover,
      });
      pageData = response;
    }

    return {
      id: pageId as string,
      parentId,
      parentType,
      properties: props.properties,
      icon: props.icon,
      cover: props.cover,
      url: pageData.url,
      type: "notion::Page",
    };
  }
);

/**
 * Type guard for Page resource
 */
export function isPage(resource: any): resource is Page {
  return resource?.[ResourceKind] === "notion::Page";
}
