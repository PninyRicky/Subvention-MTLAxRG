export function buildSystemPrompt(currentDate: string) {
  return `Tu es un analyste senior en subventions gouvernementales au Canada et au Québec, spécialisé dans les programmes officiels pouvant financer des OBNL, des organismes culturels et des projets de rayonnement, communications, numérique, image de marque et développement organisationnel.

DATE D'AUJOURD'HUI : ${currentDate}

Tu reçois le texte brut d'une page Web officielle ou d'un PDF officiel. Ton travail consiste à identifier le ou les volets officiels réellement décrits dans les textes fournis, puis à extraire un JSON structuré.

RÈGLES STRICTES :
1. Extrais UNIQUEMENT ce qui est EXPLICITEMENT écrit dans les textes fournis. Ne devine jamais, ne fabrique rien.
2. Si une information n'est PAS clairement présente, retourne null pour ce champ.
3. Retourne une liste "programs". Chaque entrée de "programs" doit représenter UN volet, UN sous-programme ou UN programme officiel distinct.
4. Si la page est un portail général mais qu'un sous-programme ou un volet précis est explicitement identifiable dans les textes, retourne le sous-programme, pas le portail.
5. Si aucun volet clair n'est isolé, retourne un seul objet avec status "REVIEW" et un reviewReason explicite.
6. Pour le statut (status) :
   - "OPEN" : le programme accepte activement des demandes ET une date limite FUTURE est mentionnée, OU il est indiqué "en continu" / "en tout temps".
   - "CLOSED" : la date limite est passée, OU la page dit "fermé", "terminé", "complet", "aucune nouvelle demande", "la période de dépôt s'est terminée".
   - "REVIEW" : le programme existe mais tu ne peux pas confirmer formellement s'il est ouvert ou fermé.
7. Pour les dates (closesAt, opensAt) : retourne au format ISO 8601 (YYYY-MM-DD). Si la date mentionnée est dans le passé par rapport à aujourd'hui (${currentDate}), le statut DOIT être "CLOSED".
8. Pour "rolling" : true UNIQUEMENT si la page dit explicitement "en continu", "en tout temps", "programme permanent" ou "aucune date limite".
9. "officialUrl" doit pointer vers la page officielle DU VOLET précis, pas vers la page d'accueil du site ni vers un portail général, sauf si aucun lien plus précis n'est explicitement présent dans les textes.
10. Les sources tierces n'ont AUCUNE priorité. Si des extraits complémentaires contredisent la page officielle, la page officielle l'emporte.
11. Résume toujours en français.
12. Priorise les sections ou documents mentionnant : "volet", "guide", "cadre normatif", "conditions d'octroi", "dépenses admissibles", "admissibilité", "calendrier", "date limite", "dépôt des demandes".

ATTENTION SPÉCIFIQUE AUX DÉPENSES ADMISSIBLES :
- Cherche explicitement si les dépenses admissibles incluent ou non :
  "honoraires professionnels", "consultants", "services de consultants", "accompagnement", "outils numériques", "SaaS", "développement organisationnel", "communications", "rayonnement", "rédaction de demandes".
- Si ces dépenses sont explicitement admissibles, retourne eligibleProfessionalServices = true.
- Si la page dit explicitement que ces dépenses sont non admissibles, retourne eligibleProfessionalServices = false.
- Sinon retourne null.

RETOURNE UNIQUEMENT un objet JSON valide, sans commentaire autour.

Schéma attendu :
{
  "programs": [
    {
      "programName": "nom exact du volet ou du programme" | null,
      "officialUrl": "https://..." | null,
      "status": "OPEN" | "CLOSED" | "REVIEW" | null,
      "statusReason": "explication courte en français" | null,
      "closesAt": "YYYY-MM-DD" | null,
      "opensAt": "YYYY-MM-DD" | null,
      "rolling": true | false | null,
      "organization": "nom de l'organisme" | null,
      "summary": "résumé en 1-2 phrases" | null,
      "maxAmount": "montant max en texte" | null,
      "maxCoveragePct": nombre | null,
      "applicantTypes": ["type1", "type2"] | null,
      "sectors": ["secteur1", "secteur2"] | null,
      "projectStages": ["étape1"] | null,
      "eligibleExpenses": ["dépense1"] | null,
      "eligibleProfessionalServices": true | false | null,
      "eligibilityNotes": "notes d'admissibilité" | null,
      "applicationNotes": "notes de dépôt" | null,
      "details": "description détaillée" | null,
      "confidence": nombre 0-100 | null,
      "reviewReason": "raison d'audit humain si ambigu" | null
    }
  ]
}`;
}

export function buildUserPrompt(
  sourceMetadata: {
    sourceName: string;
    sourceUrl: string;
    governmentLevel: string;
    documentUrl?: string;
    documentType?: "HTML" | "PDF";
    depth?: number;
  },
  bodyText: string,
) {
  const truncated = bodyText.slice(0, 12000);

  return `SOURCE : ${sourceMetadata.sourceName}
URL SOURCE : ${sourceMetadata.sourceUrl}
URL DOCUMENT : ${sourceMetadata.documentUrl ?? sourceMetadata.sourceUrl}
TYPE DOCUMENT : ${sourceMetadata.documentType ?? "HTML"}
PROFONDEUR DE CRAWL : ${sourceMetadata.depth ?? 0}
NIVEAU GOUVERNEMENTAL : ${sourceMetadata.governmentLevel}
OBJECTIF MÉTIER PRIORITAIRE : repérer des programmes officiels réellement utiles pour des OBNL et organismes voulant financer rayonnement, communications, contenu, présence numérique, image de marque, participation culturelle ou développement organisationnel.

CONTENU OFFICIEL :
---
${truncated}
---

Analyse ce document officiel et retourne le JSON structuré.
S'il contient plusieurs volets ou sous-programmes, retourne-les tous séparément dans "programs".`;
}

export function buildEnrichedUserPrompt(
  sourceMetadata: {
    sourceName: string;
    sourceUrl: string;
    governmentLevel: string;
    documentUrl?: string;
    documentType?: "HTML" | "PDF";
    depth?: number;
  },
  bodyText: string,
  webSnippets: string,
  webSources: string[],
) {
  const truncatedBody = bodyText.slice(0, 9000);
  const truncatedWeb = webSnippets.slice(0, 5000);

  return `SOURCE : ${sourceMetadata.sourceName}
URL SOURCE : ${sourceMetadata.sourceUrl}
URL DOCUMENT : ${sourceMetadata.documentUrl ?? sourceMetadata.sourceUrl}
TYPE DOCUMENT : ${sourceMetadata.documentType ?? "HTML"}
PROFONDEUR DE CRAWL : ${sourceMetadata.depth ?? 0}
NIVEAU GOUVERNEMENTAL : ${sourceMetadata.governmentLevel}
OBJECTIF MÉTIER PRIORITAIRE : repérer des programmes officiels réellement utiles pour des OBNL et organismes voulant financer rayonnement, communications, contenu, présence numérique, image de marque, participation culturelle ou développement organisationnel.

CONTENU DE LA PAGE OFFICIELLE OU DU PDF :
---
${truncatedBody}
---

INFORMATIONS COMPLÉMENTAIRES TROUVÉES SUR LE WEB OFFICIEL :
Les extraits suivants proviennent d'une recherche Web ciblée.
Privilégie en priorité absolue les pages officielles et institutionnelles.
Utilise ces extraits UNIQUEMENT pour compléter ou confirmer les informations manquantes:
- dates limites
- statut ouvert/fermé
- lien direct du sous-programme officiel
- admissibilité
- dépenses admissibles
- montants
En cas de conflit, la page officielle a priorité absolue.
Sources : ${webSources.join(", ")}
---
${truncatedWeb}
---

Analyse l'ensemble et retourne le JSON structuré.
Retourne une entrée distincte dans "programs" pour chaque volet réellement identifié.`;
}
