export type LinearTeamNode = {
  id: string;
  name: string;
  key: string;
  description?: string | null;
};

export type LinearProjectNode = {
  id: string;
  name: string;
  description?: string | null;
  teams?: { nodes: Array<{ id: string }> };
};

export type LinearLabelNode = {
  id: string;
  name: string;
  color?: string | null;
  team?: { id: string } | null;
};

export type LinearWebhookNode = {
  id: string;
  url: string;
  resourceTypes: string[];
  team?: { id: string } | null;
};

export type TeamCreateResponse = {
  teamCreate: { team: LinearTeamNode };
};

export type TeamUpdateResponse = {
  teamUpdate: { team: LinearTeamNode };
};

export type TeamDeleteResponse = {
  teamDelete: { success: boolean };
};

export type TeamQueryResponse = {
  team: LinearTeamNode;
};

export type TeamsQueryResponse = {
  teams: { nodes: LinearTeamNode[] };
};

export type ProjectCreateResponse = {
  projectCreate: { project: LinearProjectNode };
};

export type ProjectUpdateResponse = {
  projectUpdate: { project: LinearProjectNode };
};

export type ProjectDeleteResponse = {
  projectDelete: { success: boolean };
};

export type ProjectQueryResponse = {
  project: LinearProjectNode;
};

export type IssueLabelCreateResponse = {
  issueLabelCreate: { issueLabel: LinearLabelNode };
};

export type IssueLabelUpdateResponse = {
  issueLabelUpdate: { issueLabel: LinearLabelNode };
};

export type IssueLabelDeleteResponse = {
  issueLabelDelete: { success: boolean };
};

export type IssueLabelQueryResponse = {
  issueLabel: LinearLabelNode;
};

export type IssueLabelsQueryResponse = {
  issueLabels: { nodes: LinearLabelNode[] };
};

export type WebhookCreateResponse = {
  webhookCreate: { webhook: LinearWebhookNode };
};

export type WebhookUpdateResponse = {
  webhookUpdate: { webhook: LinearWebhookNode };
};

export type WebhookDeleteResponse = {
  webhookDelete: { success: boolean };
};

export type WebhookQueryResponse = {
  webhook: LinearWebhookNode;
};

export type WebhooksQueryResponse = {
  webhooks: { nodes: LinearWebhookNode[] };
};
