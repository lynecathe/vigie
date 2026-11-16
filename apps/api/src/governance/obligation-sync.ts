import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../db/db.module";
import { obligations, type ObligationKind } from "../db/schema";
import { GDPR_KINDS, NIS2_KINDS } from "./obligation-rules";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Crée les obligations quand un indicateur passe à vrai (le compte à rebours démarre maintenant),
 * et supprime celles qui n'ont encore donné lieu à rien quand il repasse à faux.
 * Une obligation déjà décidée ou envoyée est conservée : c'est une trace d'audit.
 */
export async function syncObligations(
  tx: Tx,
  incidentId: string,
  flags: { personalData: boolean; nis2Significant: boolean },
  awareAt = new Date(),
): Promise<void> {
  const apply = async (enabled: boolean, kinds: ObligationKind[]) => {
    if (enabled) {
      await tx
        .insert(obligations)
        .values(kinds.map((kind) => ({ incidentId, kind, awareAt })))
        .onConflictDoNothing({ target: [obligations.incidentId, obligations.kind] });
    } else {
      await tx
        .delete(obligations)
        .where(
          and(
            eq(obligations.incidentId, incidentId),
            inArray(obligations.kind, kinds),
            eq(obligations.decision, "PENDING"),
            isNull(obligations.submittedAt),
          ),
        );
    }
  };
  await apply(flags.personalData, GDPR_KINDS);
  await apply(flags.nis2Significant, NIS2_KINDS);
}
