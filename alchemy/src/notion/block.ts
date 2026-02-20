import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";
import { isPage, type Page } from "./page.ts";

export interface BlockProps extends NotionApiOptions {
  /**
   * The parent page or block ID or resource
   */
  parent: string | Page | Block;

  /**
   * The block content object matching Notion's API
   * @see https://developers.notion.com/reference/block
   */
  block: BlockObjectRequest;
}

export type Block = Omit<BlockProps, "token" | "parent"> & {
  id: string;
  parentId: string;
  type: "notion::Block";
};

/**
 * Creates a Notion Block.
 *
 * @example
 * const heading = await Block("header", {
 *   parent: myPage,
 *   block: {
 *     type: "heading_1",
 *     heading_1: { rich_text: [{ text: { content: "Project Overview" } }] }
 *   }
 * });
 */
export const Block = Resource(
  "notion::Block",
  async function (
    this: Context<Block>,
    id: string,
    props: BlockProps
  ): Promise<Block> {
    const notion = createNotionClient(props);
    const parentId = isPage(props.parent) ? props.parent.id : (isBlock(props.parent) ? props.parent.id : props.parent.toString());

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

    if (this.phase === "update" && this.output) {
      // If the block type changed, we must replace
      if (this.output.block.type !== props.block.type) {
        return this.replace(true);
      }
    }

    let blockId = this.output?.id;
    let blockData: any;

    if (this.phase === "create" || !blockId) {
      const response = await notion.blocks.children.append({
        block_id: parentId,
        children: [props.block],
      });
      blockData = response.results[0];
      blockId = blockData.id;
    } else {
      // Update existing block
      const response = await notion.blocks.update({
        block_id: blockId,
        ...props.block,
      } as any);
      blockData = response;
    }

    return {
      id: blockId as string,
      parentId,
      block: props.block,
      type: "notion::Block",
    };
  }
);

/**
 * Type guard for Block resource
 */
export function isBlock(resource: any): resource is Block {
  return resource?.[ResourceKind] === "notion::Block";
}
