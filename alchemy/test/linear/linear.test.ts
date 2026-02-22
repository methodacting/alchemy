import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Team, type LinearTeam } from "../../src/linear/team.ts";
import { Project, type LinearProject } from "../../src/linear/project.ts";
import { Label, type LinearLabel } from "../../src/linear/label.ts";
import { Webhook, type LinearWebhook } from "../../src/linear/webhook.ts";
import { createLinearClient, linearGraphql } from "../../src/linear/api.ts";
import { TEAM_QUERY } from "../../src/linear/graphql.ts";
import type { TeamQueryResponse } from "../../src/linear/queries.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Linear", () => {
  test("create team, project, label and webhook", async (scope) => {
    if (!process.env.LINEAR_API_KEY) {
      console.warn("Skipping Linear tests: LINEAR_API_KEY not set");
      return;
    }

    const linear = createLinearClient();
    const baseName = `${BRANCH_PREFIX}-test`;
    const keySeed = BRANCH_PREFIX.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 1000;
    const teamKey = `T${keySeed.toString().padStart(3, "0")}`; // Linear team keys must be unique and deterministic

    let team: LinearTeam;
    let project: LinearProject;
    let label: LinearLabel;
    let webhook: LinearWebhook;

    try {
      // 1. Create Team
      team = await Team("engineering", {
        name: `${baseName} Engineering`,
        key: teamKey,
      });

      expect(team.id).toBeDefined();
      expect(team.key).toBe(teamKey);

      // 2. Create Project
      project = await Project("v1-launch", {
        name: `${baseName} Launch`,
        teams: [team],
      });

      expect(project.id).toBeDefined();
      expect(project.teamIds).toContain(team.id);

      // 3. Create Label
      label = await Label("bug", {
        name: `${baseName}-Bug`,
        color: "#eb5757",
        team,
      });

      expect(label.id).toBeDefined();
      expect(label.teamId).toBe(team.id);

      // 4. Create Webhook
      webhook = await Webhook("ops", {
        url: "https://example.com/webhooks/linear",
        resourceTypes: ["Issue", "Project"],
        team,
      });

      expect(webhook.id).toBeDefined();
      expect(webhook.teamId).toBe(team.id);

      // Verify via GraphQL
      const apiTeam = await linearGraphql<TeamQueryResponse>(linear, TEAM_QUERY, {
        id: team.id,
      });
      expect(apiTeam.team.name).toBe(`${baseName} Engineering`);

    } finally {
      await destroy(scope);
    }
  }, 180000);
});
