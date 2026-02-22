# Linear

The Linear provider allows you to manage teams, projects, labels, and webhooks in your Linear workspace as code.

[Official Linear Developer Portal](https://linear.app/developers)

## Notes

For initial workspace scaffolding, focus on `Team`, `Project`, and `Webhook`. Teams and projects define the structure, and webhooks keep external systems (GitHub, CI, etc.) in sync.

## Resources

- [Team](./team.md) - Create and manage Linear teams.
- [Project](./project.md) - Organize work into projects.
- [Label](./label.md) - Standardize issue categorization.
- [Webhook](./webhook.md) - Integrate Linear with external systems.

## Example Usage

```ts
import { Team, Project, Label, Webhook } from "alchemy/linear";

// 1. Create an engineering team
const eng = await Team("engineering", {
  name: "Engineering",
  key: "ENG"
});

// 2. Setup a project for the team
const launch = await Project("v1", {
  name: "V1 Launch",
  teams: [eng]
});

// 3. Define standard labels
await Label("bug", { name: "Bug", color: "#eb5757", team: eng });

// 4. Integrated alerting
await Webhook("ops", {
  url: "https://api.example.com/linear",
  resourceTypes: ["Issue", "Project"],
  team: eng
});
```
