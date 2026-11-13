import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { Conversation, Message } from '../src/modules/conversations/model.js';
import { Listing } from '../src/modules/listings/model.js';
import { User } from '../src/models/user.model.js';
import { getConversation, sendMessage, startConversation } from '../src/modules/conversations/service.js';
const buyer = new Types.ObjectId(), seller = new Types.ObjectId(), listingId = new Types.ObjectId();
const c = new Conversation({ buyerId: buyer, sellerId: seller, listingId });
const listing = new Listing({ _id: listingId, sellerId: seller });
afterEach(() => vi.restoreAllMocks());
describe('Messaging service rules (mocked database operations)', () => {
  it('creates a conversation using listing ownership', async () => {
    vi.spyOn(Listing, 'findOne').mockResolvedValue(listing); vi.spyOn(User, 'exists').mockResolvedValue({ _id: seller }); vi.spyOn(Conversation, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(Conversation, 'create').mockResolvedValue(c as never);
    expect((await startConversation(String(buyer), String(listingId))).created).toBe(true);
    expect(create).toHaveBeenCalledWith({ buyerId: String(buyer), listingId: String(listingId), sellerId: seller });
  });
  it('returns an existing conversation without creating', async () => {
    vi.spyOn(Listing, 'findOne').mockResolvedValue(listing); vi.spyOn(User, 'exists').mockResolvedValue({ _id: seller }); vi.spyOn(Conversation, 'findOne').mockResolvedValue(c);
    const create = vi.spyOn(Conversation, 'create'); expect((await startConversation(String(buyer), String(listingId))).created).toBe(false); expect(create).not.toHaveBeenCalled();
  });
  it('recovers a duplicate-key race by retrieving the winning conversation', async () => {
    vi.spyOn(Listing, 'findOne').mockResolvedValue(listing); vi.spyOn(User, 'exists').mockResolvedValue({ _id: seller }); vi.spyOn(Conversation, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(c);
    vi.spyOn(Conversation, 'create').mockRejectedValue({ code: 11000 });
    expect((await startConversation(String(buyer), String(listingId))).data._id).toBe(String(c._id));
  });
  it('rejects self-contact before persistence', async () => {
    vi.spyOn(Listing, 'findOne').mockResolvedValue(listing); const create = vi.spyOn(Conversation, 'create');
    await expect(startConversation(String(seller), String(listingId))).rejects.toMatchObject({ status: 400 }); expect(create).not.toHaveBeenCalled();
  });
  it('requires an available listing and eligible seller', async () => {
    const find = vi.spyOn(Listing, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(listing);
    await expect(startConversation(String(buyer), String(listingId))).rejects.toMatchObject({ status: 404 }); expect(find).toHaveBeenCalledWith({ _id: String(listingId), status: 'available' });
    vi.spyOn(User, 'exists').mockResolvedValue(null); await expect(startConversation(String(buyer), String(listingId))).rejects.toMatchObject({ status: 409 });
  });
  it('scopes lookup to both participants and denies missing membership', async () => {
    const find = vi.spyOn(Conversation, 'findOne').mockResolvedValue(null);
    await expect(getConversation(String(c._id), String(buyer))).rejects.toMatchObject({ status: 404 });
    expect(find).toHaveBeenCalledWith({ _id: String(c._id), $or: [{ buyerId: String(buyer) }, { sellerId: String(buyer) }] });
  });
  it('blocks outsider send before message creation', async () => {
    vi.spyOn(Conversation, 'findOne').mockResolvedValue(null); const create = vi.spyOn(Message, 'create');
    await expect(sendMessage(String(c._id), String(new Types.ObjectId()), 'hello')).rejects.toMatchObject({ status: 404 }); expect(create).not.toHaveBeenCalled();
  });
  it('saves the authenticated sender and updates the summary', async () => {
    vi.spyOn(Conversation, 'findOne').mockResolvedValue(c); vi.spyOn(Listing, 'exists').mockResolvedValue({ _id: listingId }); vi.spyOn(User, 'exists').mockResolvedValue({ _id: seller });
    const m = new Message({ conversationId: c._id, senderId: buyer, text: 'hello', createdAt: new Date(), updatedAt: new Date() });
    const create = vi.spyOn(Message, 'create').mockResolvedValue(m as never); const update = vi.spyOn(Conversation, 'updateOne').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
    expect((await sendMessage(String(c._id), String(buyer), 'hello')).text).toBe('hello');
    expect(create).toHaveBeenCalledWith({ conversationId: String(c._id), senderId: String(buyer), text: 'hello' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ _id: String(c._id) }), { $set: { lastMessage: 'hello', lastMessageAt: m.createdAt, lastMessageId: m._id } });
  });
  it('rejects sending after the listing becomes unavailable', async () => {
    vi.spyOn(Conversation, 'findOne').mockResolvedValue(c); vi.spyOn(Listing, 'exists').mockResolvedValue(null); vi.spyOn(User, 'exists').mockResolvedValue({ _id: seller }); const create = vi.spyOn(Message, 'create');
    await expect(sendMessage(String(c._id), String(buyer), 'hello')).rejects.toMatchObject({ status: 409 }); expect(create).not.toHaveBeenCalled();
  });
  it('defines the unique buyer/listing index and validates message content', async () => {
    expect(Conversation.schema.indexes()).toContainEqual([{ buyerId: 1, listingId: 1 }, expect.objectContaining({ unique: true })]);
    await expect(new Conversation({ buyerId: buyer, sellerId: buyer, listingId }).validate()).rejects.toThrow();
    for (const text of ['', '  ', 'x'.repeat(2001)]) await expect(new Message({ conversationId: c._id, senderId: buyer, text }).validate()).rejects.toThrow();
  });
});
