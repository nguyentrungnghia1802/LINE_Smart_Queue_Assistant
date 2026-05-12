/**
 * LINE Messaging API adapter interface.
 *
 * The adapter decouples domain/service logic from the LINE SDK so that:
 *   • Unit tests can inject a MockLineAdapter with zero HTTP calls.
 *   • The real SDK (LineSdkAdapter) is isolated in one file.
 *   • Swapping transports (e.g. bot-sdk → raw fetch → different provider)
 *     requires changes only in the adapter implementation, not in callers.
 */

export interface LineTextMessage {
  type: 'text';
  text: string;
}

/**
 * Union of all supported LINE message types.
 * Add `LineFlexMessage`, `LineStickerMessage`, etc. as queue flow requires.
 */
export type LineMessage = LineTextMessage;

export interface ILineMessagingAdapter {
  /**
   * Push one or more messages to a specific user.
   * Requires a Channel Access Token with push-message permission.
   * Does not need a replyToken — can be called at any time.
   */
  pushMessage(to: string, messages: LineMessage[]): Promise<void>;

  /**
   * Reply to an event using the event's single-use replyToken.
   * The token expires 30 seconds after the event was received.
   */
  replyMessage(replyToken: string, messages: LineMessage[]): Promise<void>;
}
