// Response DTO shapes returned by the Voi API.
// These mirror apps/api/src/services/session-presenter.ts and the route handlers.
// Request payload types are derived from the zod schemas in @voi/shared.
import type {
  PaymentStatus,
  RsvpStatus,
  SessionVisibility,
  SkillLevel,
} from "@voi/shared";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  defaultSkillLevel: SkillLevel;
}

export interface AuthResponse {
  token?: string;
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  defaultVenueName: string | null;
  defaultSkillLevel: SkillLevel;
  currency: string;
  memberCount: number;
  upcomingSessionCount?: number;
}

export interface GroupMember {
  id: string;
  role: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    defaultSkillLevel: SkillLevel;
  };
}

export interface SessionReference {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string;
  courtCount: number;
  maxPlayers: number;
  status: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  defaultVenueName: string | null;
  defaultSkillLevel: SkillLevel;
  currency: string;
  members: GroupMember[];
  sessions: SessionReference[];
}

export interface SessionSummary {
  joinedPlayerCount: number;
  waitlistCount: number;
  availableSlots: number;
  totalCostVnd: number;
  perPlayerCostVnd: number | null;
}

export interface SessionParticipant {
  id: string;
  userId: string;
  rsvpStatus: RsvpStatus;
  waitlistPosition: number | null;
  paymentStatus: PaymentStatus;
  joinedAt: string | null;
  checkedInAt: string | null;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    defaultSkillLevel: SkillLevel | null;
  };
}

export interface LineupSlot {
  id: string;
  participantId: string;
  slotOrder: number;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Court {
  id: string;
  label: string;
  sortOrder: number;
  lineupSlots: LineupSlot[];
}

export interface SessionDetail {
  id: string;
  groupId: string;
  hostUserId: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueNote: string | null;
  courtCount: number;
  maxPlayers: number;
  feeTotalVnd: number | null;
  shuttlecockCostVnd: number | null;
  currency: string;
  skillLevel: SkillLevel;
  visibility: SessionVisibility;
  status: string;
  createdAt: string;
  updatedAt: string;
  group: { id: string; name: string };
  inviteUrlToken: string | null;
  imageUrls: string[];
  feePerPlayerVnd: number | null;
  costTrackingEnabled: boolean;
  venueLat: number | null;
  venueLng: number | null;
  summary: SessionSummary;
  participants: SessionParticipant[];
  courts: Court[];
}

export interface InviteDetail {
  id: string;
  token: string;
  group: { id: string; name: string } | null;
  session: SessionDetail | null;
}

export type SessionCard = Omit<SessionDetail, "participants" | "courts">;
export type PublicUser = Omit<UserProfile, "email">;
export interface Person extends PublicUser {
  role: "host" | "player";
  isHost: boolean;
  activityCount: number;
  hostedCount: number;
  averageRating: number | null;
  reviewCount: number;
}
export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: PublicUser;
}
export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: PublicUser;
}
export interface AppNotification {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  session: {
    id: string;
    title: string | null;
    startsAt: string;
    venueName: string;
  } | null;
}
export interface NotificationPreference {
  remindersEnabled: boolean;
  statusChangesEnabled: boolean;
  waitlistEnabled: boolean;
  reminderLeadMinutes: number;
}
export interface MatchResult {
  id: string;
  label: string;
  scoreA: number;
  scoreB: number;
}
