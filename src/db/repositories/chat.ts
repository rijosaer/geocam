// Historial del Tutor IA en SQLite (C1). La conversación actual se recuerda en sync_meta,
// así al abrir la app el chat sigue donde iba.
import { and, asc, eq, notInArray } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import type { UIMessage } from 'ai';
import { db } from '@/db/client';
import { chatMessages } from '@/db/schema';
import { syncMetaRepo } from '@/db/repositories/syncMeta';

const currentKey = (ownerId: string) => `tutor:conversacion:${ownerId}`;

export const chatRepo = {
  /** Id de la conversación abierta; si no hay ninguna, crea una. */
  async currentConversation(ownerId: string): Promise<string> {
    const saved = await syncMetaRepo.get(currentKey(ownerId));
    if (saved) return saved;
    return chatRepo.newConversation(ownerId);
  },

  /** "Nueva conversación": la anterior queda guardada, pero ya no se muestra. */
  async newConversation(ownerId: string): Promise<string> {
    const id = Crypto.randomUUID();
    await syncMetaRepo.set(currentKey(ownerId), id);
    return id;
  },

  async load(ownerId: string, conversationId: string): Promise<UIMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.ownerId, ownerId), eq(chatMessages.conversationId, conversationId)))
      .orderBy(asc(chatMessages.position));
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      parts: JSON.parse(r.parts) as UIMessage['parts'],
    }));
  },

  /**
   * Guarda la conversación completa tal como la tiene useChat: upsert por id (no duplica) y
   * borra los mensajes que ya no están (por ejemplo, la respuesta que se reemplazó con
   * "Reintentar").
   */
  async save(ownerId: string, conversationId: string, messages: UIMessage[]): Promise<void> {
    for (const [position, m] of messages.entries()) {
      const parts = JSON.stringify(m.parts);
      await db
        .insert(chatMessages)
        .values({ id: m.id, ownerId, conversationId, role: m.role, parts, position })
        .onConflictDoUpdate({ target: chatMessages.id, set: { parts, position } });
    }
    const ids = messages.map((m) => m.id);
    const sameConversation = and(
      eq(chatMessages.ownerId, ownerId),
      eq(chatMessages.conversationId, conversationId)
    );
    await db
      .delete(chatMessages)
      .where(ids.length > 0 ? and(sameConversation, notInArray(chatMessages.id, ids)) : sameConversation);
  },
};
