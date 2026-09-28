export type Audience = "everyone" | "followers" | "subscribers";
export type LiveEvent = {
  id: string; type: "Chat" | "Gift" | "Follow" | "Join" | "SuperFanJoin" | "Sticker" | "Like"; user: string; detail: string; time: string;
  profilePictureUrl?: string; likeCount?: number; totalLikeCount?: number; giftName?: string; giftImageUrl?: string; stickerId?: string; stickerImageUrl?: string; stickerName?: string; count?: number; comboComplete?: boolean;
  followRole?: number; isFollower?: boolean; isSubscriber?: boolean;
};
export type ProviderStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
export interface LiveProvider {
  diagnostics?(): unknown;
  onRoom?(handler: (roomId: string) => void): () => void;
  connect(username: string): Promise<void>; disconnect(): Promise<void>; status(): ProviderStatus;
  onEvent(handler: (event: LiveEvent) => void): () => void;
  onStatus(handler: (status: ProviderStatus, message?: string) => void): () => void;
}


