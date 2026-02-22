/**
 * Discord Channel Types
 * @see https://discord.com/developers/docs/resources/channel#channel-object-channel-types
 */
export enum DiscordChannelType {
  GuildText = 0,
  DirectMessage = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnouncement = 5,
  AnnouncementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15,
  GuildMedia = 16,
}

/**
 * Discord Permission Flags
 * @see https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
 */
export const DiscordPermissions = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageEmojisAndStickers: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
} as const;

export type DiscordPermissionName = keyof typeof DiscordPermissions;

/**
 * Discord Permission Overwrite Types
 */
export enum DiscordPermissionOverwriteType {
  Role = 0,
  Member = 1,
}

/**
 * Discord API structures
 * @internal
 */
export interface DiscordApiGuild {
  id: string;
  name: string;
  owner_id: string;
  verification_level: number;
}

export interface DiscordApiChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string;
  topic?: string;
  nsfw?: boolean;
}

export interface DiscordApiRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
}

export interface DiscordApiWebhook {
  id: string;
  name: string;
  channel_id: string;
  guild_id?: string;
  token?: string;
  url?: string;
  avatar?: string;
}

export interface DiscordApiEmoji {
  id: string;
  name: string;
  roles?: string[];
  user?: { id: string; username: string };
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

/**
 * Discord Sticker Types
 */
export enum DiscordStickerType {
  Standard = 1,
  Guild = 2,
}

/**
 * Discord Sticker Format Types
 */
export enum DiscordStickerFormatType {
  PNG = 1,
  APNG = 2,
  LOTTIE = 3,
  GIF = 4,
}

/**
 * Discord API Sticker
 * @internal
 */
export interface DiscordApiSticker {
  id: string;
  pack_id?: string;
  name: string;
  description?: string | null;
  tags: string;
  type: DiscordStickerType | number;
  format_type: DiscordStickerFormatType | number;
  available?: boolean;
  guild_id?: string;
  user?: { id: string; username: string };
  sort_value?: number;
}

/**
 * Discord API Soundboard Sound
 * @internal
 */
export interface DiscordApiSoundboardSound {
  name: string;
  sound_id: string;
  volume: number;
  emoji_id?: string | null;
  emoji_name?: string | null;
  guild_id?: string;
  available?: boolean;
  user?: { id: string; username: string };
}

/**
 * Discord Application Command Types
 */
export enum DiscordApplicationCommandType {
  ChatInput = 1,
  User = 2,
  Message = 3,
}

/**
 * Discord Application Command Option Types
 */
export enum DiscordApplicationCommandOptionType {
  SubCommand = 1,
  SubCommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
  Attachment = 11,
}

/**
 * Discord Application Command Option Choice
 */
export interface DiscordApplicationCommandOptionChoice {
  name: string;
  value: string | number;
}

/**
 * Discord Application Command Option
 */
export interface DiscordApplicationCommandOption {
  type: DiscordApplicationCommandOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: DiscordApplicationCommandOptionChoice[];
  options?: DiscordApplicationCommandOption[];
  channel_types?: DiscordChannelType[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}

/**
 * Discord API Application Command
 * @internal
 */
export interface DiscordApiApplicationCommand {
  id: string;
  application_id: string;
  guild_id?: string;
  name: string;
  description: string;
  options?: DiscordApplicationCommandOption[];
  default_member_permissions?: string | null;
  dm_permission?: boolean;
  type?: DiscordApplicationCommandType;
  nsfw?: boolean;
  version: string;
}

/**
 * Discord Auto Moderation Trigger Types
 */
export enum DiscordAutoModerationTriggerType {
  Keyword = 1,
  Spam = 3,
  KeywordPreset = 4,
  MentionSpam = 5,
  MemberProfile = 6,
}

/**
 * Discord Auto Moderation Event Types
 */
export enum DiscordAutoModerationEventType {
  MessageSend = 1,
  MemberUpdate = 2,
}

/**
 * Discord Auto Moderation Action Types
 */
export enum DiscordAutoModerationActionType {
  BlockMessage = 1,
  SendAlertMessage = 2,
  Timeout = 3,
  BlockMemberInteraction = 4,
}

/**
 * Discord Auto Moderation Keyword Preset Types
 */
export enum DiscordAutoModerationKeywordPresetType {
  Profanity = 1,
  SexualContent = 2,
  Slurs = 3,
}

/**
 * Discord Auto Moderation Action
 */
export interface DiscordAutoModerationAction {
  type: DiscordAutoModerationActionType;
  metadata?: {
    channel_id?: string;
    duration_seconds?: number;
    custom_message?: string;
  };
}

/**
 * Discord Auto Moderation Trigger Metadata
 */
export interface DiscordAutoModerationTriggerMetadata {
  keyword_filter?: string[];
  regex_patterns?: string[];
  presets?: DiscordAutoModerationKeywordPresetType[];
  allow_list?: string[];
  mention_total_limit?: number;
  mention_raid_protection_enabled?: boolean;
}

/**
 * Discord API Auto Moderation Rule
 * @internal
 */
export interface DiscordApiAutoModerationRule {
  id: string;
  guild_id: string;
  name: string;
  creator_id: string;
  event_type: DiscordAutoModerationEventType;
  trigger_type: DiscordAutoModerationTriggerType;
  trigger_metadata: DiscordAutoModerationTriggerMetadata;
  actions: DiscordAutoModerationAction[];
  enabled: boolean;
  exempt_roles: string[];
  exempt_channels: string[];
}

/**
 * Discord API Invite
 * @internal
 */
export interface DiscordApiInvite {
  code: string;
  guild?: Partial<DiscordApiGuild>;
  channel?: Partial<DiscordApiChannel>;
  inviter?: { id: string; username: string };
  target_type?: number;
  expires_at?: string;
  uses?: number;
  max_uses?: number;
  max_age?: number;
  temporary?: boolean;
  created_at?: string;
}

/**
 * Discord Scheduled Event Privacy Level
 */
export enum DiscordScheduledEventPrivacyLevel {
  GuildOnly = 2,
}

/**
 * Discord Scheduled Event Entity Types
 */
export enum DiscordScheduledEventEntityType {
  StageInstance = 1,
  Voice = 2,
  External = 3,
}

/**
 * Discord Scheduled Event Status
 */
export enum DiscordScheduledEventStatus {
  Scheduled = 1,
  Active = 2,
  Completed = 3,
  Canceled = 4,
}

/**
 * Discord API Scheduled Event
 * @internal
 */
export interface DiscordApiScheduledEvent {
  id: string;
  guild_id: string;
  channel_id?: string;
  creator_id?: string;
  name: string;
  description?: string;
  scheduled_start_time: string;
  scheduled_end_time?: string;
  privacy_level: DiscordScheduledEventPrivacyLevel;
  status: DiscordScheduledEventStatus;
  entity_type: DiscordScheduledEventEntityType;
  entity_id?: string;
  entity_metadata?: { location?: string };
  image?: string;
}

/**
 * Discord Onboarding Prompt Type
 */
export enum DiscordOnboardingPromptType {
  MultipleChoice = 0,
  Dropdown = 1,
}

/**
 * Discord Onboarding Mode
 */
export enum DiscordOnboardingMode {
  Default = 0,
  Advanced = 1,
}

/**
 * Discord API Onboarding Option
 * @internal
 */
export interface DiscordApiOnboardingOption {
  id: string;
  channel_ids: string[];
  role_ids: string[];
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
  title: string;
  description?: string;
}

/**
 * Discord API Onboarding Prompt
 * @internal
 */
export interface DiscordApiOnboardingPrompt {
  id: string;
  type: DiscordOnboardingPromptType;
  options: DiscordApiOnboardingOption[];
  title: string;
  single_select: boolean;
  required: boolean;
  in_onboarding: boolean;
}

/**
 * Discord API Guild Onboarding
 * @internal
 */
export interface DiscordApiGuildOnboarding {
  guild_id: string;
  prompts: DiscordApiOnboardingPrompt[];
  default_channel_ids: string[];
  enabled: boolean;
  mode: DiscordOnboardingMode;
}

/**
 * Discord Verification Level
 */
export enum DiscordVerificationLevel {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  VeryHigh = 4,
}
