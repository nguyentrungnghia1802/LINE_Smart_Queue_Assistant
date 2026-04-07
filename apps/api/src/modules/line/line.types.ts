// LINE Messaging API event types used by the webhook handler.
// Extend as additional event types are handled.

export type LineEventType = 'follow' | 'unfollow' | 'message' | 'postback' | 'join' | 'leave';

export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

export interface LineEvent {
  type: LineEventType;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
  };
  postback?: {
    data: string;
  };
}
