import Dexie, { type Table } from "dexie"
import type { Chat, Message } from "./types"

class AmberDB extends Dexie {
  chats!: Table<Chat, string>
  messages!: Table<Message, string>

  constructor() {
    super("amber")
    this.version(1).stores({
      chats: "id, updatedAt, kind",
      messages: "id, chatId, createdAt",
    })
  }
}

export const db = new AmberDB()

/** Mark any messages left "streaming" by a killed session as interrupted. */
export async function recoverInterrupted(): Promise<void> {
  const stale = await db.messages
    .filter((m) => m.status === "streaming" || m.status === "pending")
    .toArray()
  await Promise.all(
    stale.map((m) =>
      db.messages.update(m.id, {
        status: m.content || m.images?.length ? "interrupted" : "error",
        error: m.content ? undefined : "Interrupted before any output",
      }),
    ),
  )
}

export async function deleteChat(chatId: string): Promise<void> {
  await db.transaction("rw", db.chats, db.messages, async () => {
    await db.messages.where("chatId").equals(chatId).delete()
    await db.chats.delete(chatId)
  })
}

export async function chatMessages(chatId: string): Promise<Message[]> {
  const msgs = await db.messages.where("chatId").equals(chatId).toArray()
  return msgs.sort((a, b) => a.createdAt - b.createdAt)
}
