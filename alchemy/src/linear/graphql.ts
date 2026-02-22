export const TEAM_CREATE_MUTATION = `
mutation TeamCreate($input: TeamCreateInput!, $copySettingsFromTeamId: String) {
  teamCreate(input: $input, copySettingsFromTeamId: $copySettingsFromTeamId) {
    team { id name key description }
  }
}`;

export const TEAM_UPDATE_MUTATION = `
mutation TeamUpdate($id: String!, $input: TeamUpdateInput!) {
  teamUpdate(id: $id, input: $input) {
    team { id name key description }
  }
}`;

export const TEAM_DELETE_MUTATION = `
mutation TeamDelete($id: String!) {
  teamDelete(id: $id) { success }
}`;

export const TEAM_QUERY = `
query Team($id: String!) {
  team(id: $id) { id name key description }
}`;

export const TEAMS_QUERY = `
query Teams($first: Int, $filter: TeamFilter) {
  teams(first: $first, filter: $filter) {
    nodes { id name key description }
  }
}`;

export const PROJECT_CREATE_MUTATION = `
mutation ProjectCreate($input: ProjectCreateInput!) {
  projectCreate(input: $input) {
    project { id name description teams { nodes { id } } }
  }
}`;

export const PROJECT_UPDATE_MUTATION = `
mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
  projectUpdate(id: $id, input: $input) {
    project { id name description teams { nodes { id } } }
  }
}`;

export const PROJECT_DELETE_MUTATION = `
mutation ProjectDelete($id: String!) {
  projectDelete(id: $id) { success }
}`;

export const PROJECT_QUERY = `
query Project($id: String!) {
  project(id: $id) { id name description teams { nodes { id } } }
}`;

export const ISSUE_LABEL_CREATE_MUTATION = `
mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) {
    issueLabel { id name color team { id } }
  }
}`;

export const ISSUE_LABEL_UPDATE_MUTATION = `
mutation IssueLabelUpdate($id: String!, $input: IssueLabelUpdateInput!) {
  issueLabelUpdate(id: $id, input: $input) {
    issueLabel { id name color team { id } }
  }
}`;

export const ISSUE_LABEL_DELETE_MUTATION = `
mutation IssueLabelDelete($id: String!) {
  issueLabelDelete(id: $id) { success }
}`;

export const ISSUE_LABEL_QUERY = `
query IssueLabel($id: String!) {
  issueLabel(id: $id) { id name color team { id } }
}`;

export const ISSUE_LABELS_QUERY = `
query IssueLabels($first: Int, $filter: IssueLabelFilter) {
  issueLabels(first: $first, filter: $filter) {
    nodes { id name color team { id } }
  }
}`;

export const WEBHOOK_CREATE_MUTATION = `
mutation WebhookCreate($input: WebhookCreateInput!) {
  webhookCreate(input: $input) {
    webhook { id url resourceTypes team { id } }
  }
}`;

export const WEBHOOK_UPDATE_MUTATION = `
mutation WebhookUpdate($id: String!, $input: WebhookUpdateInput!) {
  webhookUpdate(id: $id, input: $input) {
    webhook { id url resourceTypes team { id } }
  }
}`;

export const WEBHOOK_DELETE_MUTATION = `
mutation WebhookDelete($id: String!) {
  webhookDelete(id: $id) { success }
}`;

export const WEBHOOK_QUERY = `
query Webhook($id: String!) {
  webhook(id: $id) { id url resourceTypes team { id } }
}`;

export const WEBHOOKS_QUERY = `
query Webhooks($first: Int, $filter: WebhookFilter) {
  webhooks(first: $first, filter: $filter) {
    nodes { id url resourceTypes team { id } }
  }
}`;
