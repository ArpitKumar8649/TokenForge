import { eq, desc, and, sql, asc, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { supportMessages, users } from "../drizzle/schema";
import { cached, bustCache } from "./memoryCache";

// Each user has their own independent support message thread
function getTargetUserIds(userId: number): number[] {
  return [userId];
}

export async function sendSupportMessage(userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.insert(supportMessages).values({
    userId,
    senderRole: "user",
    content,
    isRead: false,
  });

  const [recentAdminMessage] = await db.select().from(supportMessages).where(
    and(
      inArray(supportMessages.userId, getTargetUserIds(userId)),
      eq(supportMessages.senderRole, "admin")
    )
  ).orderBy(desc(supportMessages.createdAt)).limit(1);

  const now = new Date();
  const needsAutoReply = !recentAdminMessage || (now.getTime() - recentAdminMessage.createdAt.getTime() > 2 * 60 * 60 * 1000);

  if (needsAutoReply) {
    await db.insert(supportMessages).values({
      userId,
      senderRole: "admin",
      content: "Your message has been received. It will be reviewed soon within 1-2 hours, keep an eye over here...",
      isRead: false,
    });
  }
  bustCache(`support_unread:${userId}`);
  bustCache("support_admin_conversations");
  return true;
}

export async function getChatHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const userIds = getTargetUserIds(userId);
  return db.select().from(supportMessages).where(inArray(supportMessages.userId, userIds)).orderBy(asc(supportMessages.createdAt));
}

export async function markUserMessagesAsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const userIds = getTargetUserIds(userId);
  await db.update(supportMessages)
    .set({ isRead: true })
    .where(and(inArray(supportMessages.userId, userIds), eq(supportMessages.senderRole, "admin")));
  bustCache(`support_unread:${userId}`);
  return true;
}

export async function getUserUnreadCount(userId: number) {
  return cached(`support_unread:${userId}`, 30_000, async () => {
    const db = await getDb();
    if (!db) return 0;
    const userIds = getTargetUserIds(userId);
    const rows = await db.select({ count: sql<number>`count(*)` })
      .from(supportMessages)
      .where(and(inArray(supportMessages.userId, userIds), eq(supportMessages.senderRole, "admin"), eq(supportMessages.isRead, false)));
    return Number(rows[0]?.count ?? 0);
  });
}

export async function getAdminConversations() {
  return cached("support_admin_conversations", 15_000, async () => {
    const db = await getDb();
    if (!db) return [];
    
    const userChats = await db.selectDistinct({ userId: supportMessages.userId }).from(supportMessages);
    
    const conversations = [];
    for (const { userId } of userChats) {
      const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
      if (!user) continue;
      
      const unreadCountRow = await db.select({ count: sql<number>`count(*)` })
        .from(supportMessages)
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderRole, "user"), eq(supportMessages.isRead, false)));
        
      const latestMsg = (await db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(desc(supportMessages.createdAt)).limit(1))[0];
      
      conversations.push({
        user: { id: user.id, name: user.name, email: user.email },
        unreadCount: Number(unreadCountRow[0].count),
        latestMessageAt: latestMsg ? latestMsg.createdAt : new Date(0),
        latestMessagePreview: latestMsg ? latestMsg.content.substring(0, 50) : "",
      });
    }
    
    return conversations.sort((a, b) => b.latestMessageAt.getTime() - a.latestMessageAt.getTime());
  });
}

export async function markAdminMessagesAsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(supportMessages)
    .set({ isRead: true })
    .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderRole, "user")));
  bustCache(`support_unread:${userId}`);
  bustCache("support_admin_conversations");
  return true;
}

export async function sendAdminReply(userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.insert(supportMessages).values({
    userId,
    senderRole: "admin",
    content,
    isRead: false,
  });
  bustCache(`support_unread:${userId}`);
  bustCache("support_admin_conversations");
  return true;
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users).where(sql`LOWER(${users.email}) = ${normalized}`).limit(1);
  return user || null;
}

export async function deleteAdminMessage(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Verify message exists and senderRole is admin (only admin messages can be deleted)
  const [msg] = await db
    .select()
    .from(supportMessages)
    .where(and(eq(supportMessages.id, messageId), eq(supportMessages.senderRole, "admin")))
    .limit(1);

  if (!msg) {
    throw new Error("Message not found or not eligible for deletion (only admin messages can be deleted).");
  }

  await db.delete(supportMessages).where(eq(supportMessages.id, messageId));
  bustCache(`support_unread:${msg.userId}`);
  bustCache("support_admin_conversations");
  return { success: true, deletedId: messageId, userId: msg.userId };
}
