export type ConversationSummary = {
  _id: string;
  listing: { _id: string; title: string; thumbnail: string | null } | null;
  otherParticipant: { _id: string; name: string };
  canSend: boolean;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
};
export type Message = { _id: string; conversationId: string; senderId: string; text: string; createdAt: string; updatedAt: string; deliveredAt?: string | null; readAt?: string | null };
export type MessagePage = { data: Message[]; conversation: ConversationSummary; page: { hasMore: boolean; nextBefore: string | null } };
export type ConversationPage = { data: ConversationSummary[]; page: { page: number; limit: number; hasMore: boolean } };
export function mergeMessages(current: Message[], incoming: Message[]) {
  return [...new Map([...current, ...incoming].map(message => [message._id, message])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id));
}

export type Offer = { _id: string; conversationId: string; offeredBy: string; amountPaise: number; status: string; previousOfferId?: string | null; createdAt: string };
