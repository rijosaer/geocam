// Perfil del estudiante para el Tutor IA (C2), guardado en SQLite.
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { NIVELES, PERFIL_POR_DEFECTO, TEMAS, type PerfilTutor } from '@/constants/tutor';

const esTema = (v: string): v is PerfilTutor['tema'] => TEMAS.some((t) => t.id === v);
const esNivel = (v: string): v is PerfilTutor['nivel'] => NIVELES.some((n) => n.id === v);

export const profileRepo = {
  byOwnerQuery(ownerId: string) {
    return db.select().from(profiles).where(eq(profiles.ownerId, ownerId));
  },

  async get(ownerId: string): Promise<PerfilTutor> {
    const row = await db.select().from(profiles).where(eq(profiles.ownerId, ownerId)).get();
    return profileRepo.toPerfil(row);
  },

  toPerfil(row: typeof profiles.$inferSelect | undefined): PerfilTutor {
    if (!row) return PERFIL_POR_DEFECTO;
    return {
      nombre: row.name,
      tema: esTema(row.topic) ? row.topic : PERFIL_POR_DEFECTO.tema,
      nivel: esNivel(row.level) ? row.level : PERFIL_POR_DEFECTO.nivel,
    };
  },

  async save(ownerId: string, perfil: PerfilTutor): Promise<void> {
    const values = {
      name: perfil.nombre.trim(),
      topic: perfil.tema,
      level: perfil.nivel,
      updatedAt: new Date(),
    };
    await db
      .insert(profiles)
      .values({ ownerId, ...values })
      .onConflictDoUpdate({ target: profiles.ownerId, set: values });
  },
};
