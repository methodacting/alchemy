import type { CreateDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";
import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";
import { isDatabase, type Database } from "./database.ts";

export interface DataSourceProps extends NotionApiOptions {
  /**
   * The parent database container ID or Database resource
   */
  database: string | Database;

  /**
   * Title of the data source
   */
  title: string;

  /**
   * Property schema for the data source
   */
  properties: CreateDatabaseParameters["properties"];

  /**
   * Whether to adopt an existing data source by ID or title
   * @default false
   */
  adopt?: boolean;
}

export type DataSource = Omit<DataSourceProps, "adopt" | "token" | "database"> & {
  id: string;
  databaseId: string;
  type: "notion::DataSource";
};

/**
 * Creates a Notion Data Source (the actual table/schema).
 *
 * @example
 * const source = await DataSource("inventory-data", {
 *   database: myDbContainer,
 *   title: "Inventory",
 *   properties: {
 *     "Item": { title: {} },
 *     "Quantity": { number: {} }
 *   }
 * });
 */
export const DataSource = Resource(
  "notion::DataSource",
  async function (
    this: Context<DataSource>,
    id: string,
    props: DataSourceProps
  ): Promise<DataSource> {
    const notion = createNotionClient(props);
    const databaseId = isDatabase(props.database) ? props.database.id : props.database.toString();

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          // Archive the data source
          // @ts-ignore
          await notion.dataSources.update({ data_source_id: this.output.id, archived: true });
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.status?.toString().includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let dataSourceId = this.output?.id;
    let dataSourceData: any;

    if (this.phase === "create" || !dataSourceId) {
      if (props.adopt && !this.isReplacement) {
        try {
          // @ts-ignore
          dataSourceData = await notion.dataSources.retrieve({ data_source_id: id });
          dataSourceId = dataSourceData.id;
        } catch (e) {
          // Fallback: search within database by title
          try {
            // @ts-ignore
            const response = await notion.dataSources.list({ database_id: databaseId });
            dataSourceData = response.results.find((ds: any) => ds.title === props.title);
            if (dataSourceData) {
              dataSourceId = dataSourceData.id;
            }
          } catch (e2) { /* ignore */ }
        }
      }

      if (!dataSourceId || this.isReplacement) {
        // @ts-ignore
        const response = await notion.dataSources.create({
          database_id: databaseId,
          title: props.title,
          properties: props.properties,
        });
        dataSourceData = response;
        dataSourceId = dataSourceData.id;
      }
    } else {
      // Update mutable properties (title, properties)
      // @ts-ignore
      const response = await notion.dataSources.update({
        data_source_id: dataSourceId,
        title: props.title,
        properties: props.properties,
      });
      dataSourceData = response;
    }

    return {
      id: dataSourceId as string,
      databaseId,
      title: props.title,
      properties: props.properties,
      type: "notion::DataSource",
    };
  }
);

/**
 * Type guard for DataSource resource
 */
export function isDataSource(resource: any): resource is DataSource {
  return resource?.[ResourceKind] === "notion::DataSource";
}
