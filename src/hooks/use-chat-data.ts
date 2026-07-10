import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import type { Chat, Message } from "@/lib/types"
import { useTemp } from "@/stores/temp"

export function useChat(chatId: string | undefined): Chat | null | undefined {
  const temp = useTemp((s) => (chatId ? s.chats[chatId] : undefined))
  const fromDb = useLiveQuery(
    async () => (chatId ? ((await db.chats.get(chatId)) ?? null) : null),
    [chatId],
  )
  if (!chatId) return null
  if (temp) return temp
  return fromDb
}

export function useChatMessages(chatId: string | undefined): Message[] {
  const tempMsgs = useTemp((s) => (chatId ? s.messages[chatId] : undefined))
  const fromDb = useLiveQuery(
    async () => {
      if (!chatId) return []
      const msgs = await db.messages.where("chatId").equals(chatId).toArray()
      return msgs.sort((a, b) => a.createdAt - b.createdAt)
    },
    [chatId],
    [],
  )
  if (tempMsgs) return tempMsgs
  return fromDb ?? []
}

export function useAllChats(): Chat[] | undefined {
  const tempChats = useTemp((s) => s.chats)
  const fromDb = useLiveQuery(
    () => db.chats.orderBy("updatedAt").reverse().toArray(),
    [],
  )
  if (fromDb === undefined) return undefined
  const temps = Object.values(tempChats).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )
  return [...temps, ...fromDb]
}
