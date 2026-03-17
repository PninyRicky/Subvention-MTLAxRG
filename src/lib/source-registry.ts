import { officialTerritorialHosts } from "@/lib/official-territorial-hosts";
import type { Prisma } from "@prisma/client";

type IntakeWindowSeed = {
  rolling?: boolean;
  opensAt?: string;
  closesAt?: string;
};

type FallbackPayloadSeed = {
  name: string;
  organization: string;
  summary: string;
  officialUrl: string;
  seedType?: "portal" | "program" | "calendar";
  governmentLevel: string;
  region: string;
  status: "OPEN" | "REVIEW" | "CLOSED";
  confidence: number;
  details: string;
  eligibilityNotes: string;
  applicationNotes: string;
  applicantTypes: string[];
  sectors: string[];
  projectStages: string[];
  eligibleExpenses: string[];
  eligibleProfessionalServices?: boolean | null;
  maxAmount: string | null;
  maxCoveragePct: number | null;
  openStatusReason: string;
  intakeWindow?: IntakeWindowSeed;
};

export type ProfileSeed = {
  name: string;
  scenario: string;
  description: string;
  criteria: Prisma.InputJsonValue;
  weights: Prisma.InputJsonValue;
  thresholds: Prisma.InputJsonValue;
};

export type OfficialSourceSeed = {
  name: string;
  url: string;
  type: "OFFICIAL";
  governmentLevel: string;
  description: string;
  fallbackPayload: FallbackPayloadSeed;
};

type RegionalReviewSourceInput = {
  name: string;
  url: string;
  organization: string;
  region: string;
  description: string;
  summary: string;
  details: string;
  eligibilityNotes: string;
  applicationNotes: string;
  applicantTypes: string[];
  sectors: string[];
  projectStages: string[];
  eligibleExpenses: string[];
  maxAmount?: string | null;
  maxCoveragePct?: number | null;
  confidence?: number;
  openStatusReason: string;
};

const officialHostMatchers = [
  /(^|\.)gouv\.qc\.ca$/i,
  /(^|\.)gc\.ca$/i,
  /(^|\.)canada\.ca$/i,
  /(^|\.)quebec\.ca$/i,
  /(^|\.)qc\.ca$/i,
];

const officialInstitutionHosts = new Set([
  "conseildesarts.ca",
  "www.conseildesarts.ca",
  "telefilm.ca",
  "www.telefilm.ca",
  "cmf-fmc.ca",
  "www.cmf-fmc.ca",
  "montreal.ca",
  "www.montreal.ca",
  "ville.montreal.qc.ca",
  "www.ville.montreal.qc.ca",
  "ville.quebec.qc.ca",
  "www.ville.quebec.qc.ca",
  "laval.ca",
  "www.laval.ca",
  "sherbrooke.ca",
  "www.sherbrooke.ca",
  "gatineau.ca",
  "www.gatineau.ca",
  "longueuil.quebec",
  "www.longueuil.quebec",
  "cms.longueuil.quebec",
  "portneuf.ca",
  "www.portneuf.ca",
  "ville.saguenay.ca",
  "www.ville.saguenay.ca",
  "mrcmemphremagog.com",
  "www.mrcmemphremagog.com",
]);

const blockedThirdPartyHosts = new Set([
  "hellodarwin.com",
  "www.hellodarwin.com",
]);

const officialTerritorialHostSet = new Set<string>(officialTerritorialHosts);

function matchesExplicitOfficialHost(hostname: string) {
  const bareHostname = hostname.replace(/^www\./, "");
  return (
    officialInstitutionHosts.has(hostname) ||
    officialInstitutionHosts.has(bareHostname) ||
    officialTerritorialHostSet.has(hostname) ||
    officialTerritorialHostSet.has(bareHostname)
  );
}

function buildRegionalReviewSource(input: RegionalReviewSourceInput): OfficialSourceSeed {
  return {
    name: input.name,
    url: input.url,
    type: "OFFICIAL",
    governmentLevel: "Regional",
    description: input.description,
    fallbackPayload: {
      name: input.name,
      organization: input.organization,
      summary: input.summary,
      officialUrl: input.url,
      governmentLevel: "Regional",
      region: input.region,
      status: "REVIEW",
      confidence: input.confidence ?? 66,
      details: input.details,
      eligibilityNotes: input.eligibilityNotes,
      applicationNotes: input.applicationNotes,
      applicantTypes: input.applicantTypes,
      sectors: input.sectors,
      projectStages: input.projectStages,
      eligibleExpenses: input.eligibleExpenses,
      maxAmount: input.maxAmount ?? "Selon le programme",
      maxCoveragePct: input.maxCoveragePct ?? null,
      openStatusReason: input.openStatusReason,
    },
  };
}

export function isOfficialInstitutionUrl(candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  try {
    const hostname = new URL(candidate).hostname.toLowerCase();

    if (blockedThirdPartyHosts.has(hostname)) {
      return false;
    }

    if (matchesExplicitOfficialHost(hostname)) {
      return true;
    }

    return officialHostMatchers.some((matcher) => matcher.test(hostname));
  } catch {
    return false;
  }
}

export const defaultProfiles: ProfileSeed[] = [
  {
    name: "OBNL - Essence de Marque",
    scenario: "essence-marque",
    description:
      "Profil pour OBNL cherchant du financement en branding, contenu visuel, rayonnement et virage numerique.",
    criteria: {
      applicantTypes: ["OBNL", "Organisme communautaire"],
      geography: ["Quebec", "Canada"],
      sectors: [
        "marketing numerique",
        "branding",
        "rayonnement",
        "communications",
        "promotion",
        "visibilite",
        "developpement organisationnel",
        "developpement numerique",
        "mediation",
        "participation culturelle",
      ],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: [
        "branding",
        "photo",
        "video",
        "site web",
        "marketing",
        "communications",
        "promotion",
        "rayonnement",
        "contenu numerique",
        "developpement numerique",
        "fonctionnement",
        "mediation",
      ],
      excludedKeywords: ["capital", "immobilier lourd"],
    },
    weights: {
      serviceFit: 26,
      applicantFit: 22,
      geographyFit: 10,
      expenseFit: 17,
      professionalServicesFit: 15,
      deadlineFit: 5,
      confidenceFit: 10,
    },
    thresholds: {
      eligible: 70,
      review: 45,
    },
  },
  {
    name: "MTLA - Production vidéo",
    scenario: "production-video",
    description:
      "Profil pour courts metrages, documentaires, series web, clips et productions videos de MTLA.",
    criteria: {
      applicantTypes: ["Entreprise", "Producteur", "OBNL"],
      geography: ["Quebec", "Canada"],
      sectors: ["audiovisuel", "production video", "documentaire", "court metrage"],
      projectStages: ["developpement", "production", "post-production", "diffusion"],
      eligibleExpenses: ["video", "post-production", "developpement", "diffusion"],
      excludedKeywords: ["construction", "achat immobilier"],
    },
    weights: {
      serviceFit: 32,
      applicantFit: 20,
      geographyFit: 10,
      expenseFit: 18,
      professionalServicesFit: 0,
      deadlineFit: 10,
      confidenceFit: 10,
    },
    thresholds: {
      eligible: 68,
      review: 42,
    },
  },
];

export const defaultOfficialSources: OfficialSourceSeed[] = [
  {
    name: "SODEC - Soutien au developpement audiovisuel",
    url: "https://sodec.gouv.qc.ca/aide-financiere/",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Source officielle SODEC pour les programmes d'aide financiere en audiovisuel.",
    fallbackPayload: {
      name: "SODEC - Soutien au developpement audiovisuel",
      organization: "SODEC",
      summary:
        "Programme officiel de la SODEC pour appuyer le developpement de projets audiovisuels au Quebec.",
      officialUrl:
        "https://sodec.gouv.qc.ca/domaines-dintervention/cinema-et-television/aide-financiere/aide-developpement/",
      seedType: "program",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "REVIEW",
      confidence: 70,
      details:
        "Point d'entree officiel pour les aides SODEC reliees au developpement audiovisuel, a verifier a chaque scan selon les appels actifs publies par la Societe.",
      eligibilityNotes:
        "Vise principalement les entreprises et producteurs du secteur audiovisuel etablis au Quebec. Les conditions exactes varient selon le volet actif.",
      applicationNotes:
        "Le lien direct pointe vers la documentation du programme. Toujours confirmer la fenetre de depot et les formulaires sur la page officielle avant de presenter une demande.",
      applicantTypes: ["Entreprise", "Producteur"],
      sectors: ["audiovisuel", "production video"],
      projectStages: ["developpement"],
      eligibleExpenses: ["developpement", "ecriture", "preproduction"],
      maxAmount: "Variable selon le volet",
      maxCoveragePct: 75,
      openStatusReason: "Source officielle SODEC detectee. L'ouverture doit etre confirmee par les dates affichees au moment du scan.",
    },
  },
  {
    name: "CALQ - Obtenir une aide financiere",
    url: "https://www.calq.gouv.qc.ca/aide-financiere/obtenir-aide-financiere/",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Page officielle du CALQ pour les programmes d'aide financiere.",
    fallbackPayload: {
      name: "CALQ - Aide financiere",
      organization: "Conseil des arts et des lettres du Quebec",
      summary:
        "Portail officiel du CALQ pour les aides destinees aux artistes, organismes et collectifs du Quebec.",
      officialUrl: "https://www.calq.gouv.qc.ca/aide-financiere/obtenir-aide-financiere/",
      seedType: "portal",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "REVIEW",
      confidence: 66,
      details:
        "Source officielle pertinente pour les organismes culturels, artistes et collectifs qui cherchent du soutien en creation, production, rayonnement ou circulation.",
      eligibilityNotes:
        "Le programme exact depend du profil du demandeur et de la discipline. Il faut verifier le volet et la date de depot precisement sur la fiche CALQ.",
      applicationNotes:
        "La page officielle agit comme porte d'entree. Le scan doit pointer ensuite vers le sous-programme ou l'appel actif relie au besoin.",
      applicantTypes: ["OBNL", "Artiste", "Collectif"],
      sectors: ["arts", "audiovisuel", "rayonnement"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["creation", "production", "diffusion", "rayonnement"],
      maxAmount: "Selon le programme",
      maxCoveragePct: 100,
      openStatusReason: "Portail officiel CALQ. Le statut final depend du volet et de la date de depot detectes sur la page.",
    },
  },
  {
    name: "CAC - Explorer et creer",
    url: "https://conseildesarts.ca/financement/subventions/explorer-et-creer",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Programme federal pour artistes et organismes en creation.",
    fallbackPayload: {
      name: "CAC - Explorer et creer",
      organization: "Conseil des arts du Canada",
      summary:
        "Subvention federale pour le developpement, la creation et l'experimentation de projets artistiques.",
      officialUrl: "https://conseildesarts.ca/financement/subventions/explorer-et-creer",
      seedType: "program",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 64,
      details:
        "Programme federal recurrent qui couvre plusieurs composantes selon le type de pratique, de demandeur et d'etape du projet.",
      eligibilityNotes:
        "Peut convenir a des organismes, collectifs et artistes. Le fit exact doit etre valide selon la discipline et la composante choisie.",
      applicationNotes:
        "Le lien ouvre directement la page du programme. Le scan doit confirmer la prochaine date limite ou indiquer clairement si elle reste a verifier.",
      applicantTypes: ["Artiste", "OBNL", "Collectif"],
      sectors: ["audiovisuel", "arts", "creation"],
      projectStages: ["developpement", "creation"],
      eligibleExpenses: ["creation", "recherche", "production legere"],
      maxAmount: "Selon la composante",
      maxCoveragePct: 100,
      openStatusReason: "Source officielle federale. Les dates doivent etre relues sur la composante active du programme.",
    },
  },
  {
    name: "Telefilm Canada - Financement et programmes",
    url: "https://telefilm.ca/fr/programmes/",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Catalogue officiel des programmes Telefilm Canada.",
    fallbackPayload: {
      name: "Telefilm Canada - Financement et programmes",
      organization: "Telefilm Canada",
      summary:
        "Catalogue officiel des programmes de Telefilm pour le developpement, la production et la promotion d'oeuvres audiovisuelles.",
      officialUrl: "https://telefilm.ca/fr/programmes/",
      seedType: "portal",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 62,
      details:
        "Source officielle pour les volets Telefilm en cinema et audiovisuel. La page sert a reperer les programmes actifs et leurs guides.",
      eligibilityNotes:
        "Principalement pertinent pour les entreprises et producteurs de contenu audiovisuel professionnel.",
      applicationNotes:
        "Toujours ouvrir le programme cible depuis cette page et confirmer les dates de depot, car Telefilm publie plusieurs appels distincts.",
      applicantTypes: ["Entreprise", "Producteur"],
      sectors: ["audiovisuel", "cinema", "production video"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["developpement", "production", "promotion"],
      maxAmount: "Selon le programme",
      maxCoveragePct: null,
      openStatusReason: "Source officielle Telefilm. Le statut d'ouverture doit etre derive du programme specifique, pas du catalogue general.",
    },
  },
  {
    name: "FMC - Programmes de financement",
    url: "https://cmf-fmc.ca/fr/nos-programmes/programmes-et-dates-limites/",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Catalogue officiel des programmes de financement du FMC.",
    fallbackPayload: {
      name: "FMC - Programmes de financement",
      organization: "Fonds des medias du Canada",
      summary:
        "Catalogue officiel des programmes de financement du Fonds des medias du Canada pour television, medias numeriques et contenus convergents.",
      officialUrl: "https://cmf-fmc.ca/fr/nos-programmes/programmes-et-dates-limites/",
      seedType: "calendar",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 62,
      details:
        "Point d'entree officiel pour les programmes du FMC. La page liste les volets, enveloppes et guides a consulter avant depot.",
      eligibilityNotes:
        "S'applique surtout aux entreprises et producteurs qui travaillent en audiovisuel, numerique ou contenus mediatiques convergents.",
      applicationNotes:
        "Ne pas conclure qu'un programme est ouvert simplement parce qu'il est liste. Le scan doit confirmer le volet actif et les dates officielles.",
      applicantTypes: ["Entreprise", "Producteur"],
      sectors: ["audiovisuel", "numerique", "serie web"],
      projectStages: ["developpement", "production"],
      eligibleExpenses: ["developpement", "production", "contenu numerique"],
      maxAmount: "Selon le volet",
      maxCoveragePct: null,
      openStatusReason: "Source officielle FMC. Les ouvertures et les dates sont valides uniquement au niveau du programme ou du volet cible.",
    },
  },
  {
    name: "Patrimoine canadien - Financement",
    url: "https://www.canada.ca/fr/patrimoine-canadien/services/financement.html",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Portail officiel des possibilites de financement de Patrimoine canadien.",
    fallbackPayload: {
      name: "Patrimoine canadien - Financement",
      organization: "Patrimoine canadien",
      summary:
        "Portail officiel pour reperer les subventions et contributions de Patrimoine canadien en culture, patrimoine, langues et collectivites.",
      officialUrl: "https://www.canada.ca/fr/patrimoine-canadien/services/financement.html",
      seedType: "portal",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 60,
      details:
        "Source officielle a couvrir parce qu'elle ouvre sur plusieurs programmes federaux pouvant toucher les OBNL, les organismes culturels et certains projets de rayonnement.",
      eligibilityNotes:
        "L'admissibilite varie fortement selon le programme. Le scan doit faire ressortir le sous-programme exact avant de conclure a un bon fit.",
      applicationNotes:
        "Utiliser cette page comme base officielle pour reperer les programmes actifs, puis privilegier la page detaillee du programme detecte.",
      applicantTypes: ["OBNL", "Organisme culturel", "Entreprise"],
      sectors: ["culture", "patrimoine", "rayonnement"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["production", "communications", "diffusion", "mediation"],
      maxAmount: "Selon le programme",
      maxCoveragePct: null,
      openStatusReason: "Portail officiel Patrimoine canadien. Les dates doivent etre confirmees sur la fiche detaillee du programme cible.",
    },
  },
  {
    name: "Patrimoine canadien - Développement des communautés par le biais des arts et du patrimoine",
    url: "https://www.canada.ca/fr/patrimoine-canadien/services/financement/developpement-communautes.html",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Programme officiel fédéral pour festivals, événements et projets patrimoniaux ou artistiques communautaires.",
    fallbackPayload: {
      name: "Patrimoine canadien - Développement des communautés par le biais des arts et du patrimoine",
      organization: "Patrimoine canadien",
      summary:
        "Programme fédéral destiné aux groupes locaux pour des festivals, événements et projets qui célèbrent l’histoire, le patrimoine et la participation culturelle d’une communauté.",
      officialUrl: "https://www.canada.ca/fr/patrimoine-canadien/services/financement/developpement-communautes.html",
      seedType: "portal",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 76,
      details:
        "Le programme Développement des communautés par le biais des arts et du patrimoine offre plusieurs volets et peut convenir à des organismes sans but lucratif qui misent sur le rayonnement, les publics et la mobilisation culturelle locale.",
      eligibilityNotes:
        "Vise des groupes locaux et organismes qui portent des festivals, événements, expositions ou projets patrimoniaux et artistiques à portée communautaire. Il ne finance pas de simples opérations marketing, mais peut soutenir des projets qui incluent du contenu, de la diffusion et du rayonnement.",
      applicationNotes:
        "Le scan doit distinguer le volet exact, confirmer la date limite active et pointer vers la fiche détaillée du volet lorsqu’elle est détectée.",
      applicantTypes: ["OBNL", "Organisme communautaire", "Organisme culturel", "Municipalité"],
      sectors: ["culture", "patrimoine", "rayonnement", "participation culturelle"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["diffusion", "contenu culturel", "rayonnement", "mediation"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le volet",
      maxCoveragePct: null,
      openStatusReason:
        "Programme officiel Patrimoine canadien confirmé. Le statut final doit être validé au niveau du volet actif et de ses dates.",
    },
  },
  {
    name: "Patrimoine canadien - Initiatives stratégiques du Fonds du Canada pour l’investissement en culture",
    url: "https://www.canada.ca/fr/patrimoine-canadien/services/financement/fonds-investissement-culture.html",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Programme officiel fédéral pour améliorer les pratiques d’affaires, les revenus et les capacités d’organismes artistiques et patrimoniaux.",
    fallbackPayload: {
      name: "Patrimoine canadien - Initiatives stratégiques du Fonds du Canada pour l’investissement en culture",
      organization: "Patrimoine canadien",
      summary:
        "Volet fédéral destiné aux projets partenariaux qui renforcent les opérations, les pratiques d’affaires, les revenus et l’usage stratégique des technologies dans les organismes artistiques et patrimoniaux.",
      officialUrl:
        "https://www.canada.ca/fr/patrimoine-canadien/services/financement/fonds-investissement-culture.html",
      seedType: "program",
      governmentLevel: "Federal",
      region: "Canada",
      status: "CLOSED",
      confidence: 90,
      details:
        "Ce volet était particulièrement pertinent pour des organismes qui voulaient structurer leur développement, moderniser leurs pratiques ou mutualiser des ressources. La fiche détaillée historique n’est plus accessible et le programme doit être traité comme retiré ou fermé jusqu’à preuve officielle contraire.",
      eligibilityNotes:
        "Le programme visait des organismes artistiques ou patrimoniaux dans une logique de transformation et de développement organisationnel. En l’état, la fiche active du volet n’est plus accessible.",
      applicationNotes:
        "La fiche détaillée directe renvoie désormais vers une page introuvable. Conserver le portail du Fonds du Canada pour l’investissement en culture comme point de référence institutionnel, mais traiter ce volet précis comme fermé ou retiré tant qu’une nouvelle fiche officielle n’existe pas.",
      applicantTypes: ["OBNL", "Organisme culturel", "Organisme patrimonial"],
      sectors: ["developpement organisationnel", "communications", "rayonnement", "developpement numerique"],
      projectStages: ["developpement"],
      eligibleExpenses: ["developpement numerique", "communications", "strategie", "rayonnement"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le projet",
      maxCoveragePct: null,
      openStatusReason:
        "La fiche officielle directe du volet n’existe plus et renvoie une erreur 404 sur Canada.ca. Le programme est traité comme fermé ou retiré tant qu’une page officielle active n’est pas rétablie.",
    },
  },
  {
    name: "CAC - Subventions de base aux organismes",
    url: "https://conseildesarts.ca/financement/subventions/subventions-de-base-aux-organismes",
    type: "OFFICIAL",
    governmentLevel: "Federal",
    description: "Programme officiel du Conseil des arts du Canada pour le financement stable des organismes artistiques.",
    fallbackPayload: {
      name: "CAC - Subventions de base aux organismes",
      organization: "Conseil des arts du Canada",
      summary:
        "Programme fédéral de financement pluriannuel destiné à offrir un financement stable aux organismes artistiques et de soutien.",
      officialUrl: "https://conseildesarts.ca/financement/subventions/subventions-de-base-aux-organismes",
      seedType: "program",
      governmentLevel: "Federal",
      region: "Canada",
      status: "REVIEW",
      confidence: 74,
      details:
        "Cette source est pertinente pour les organismes artistiques et culturels qui cherchent à consolider leurs capacités et leur fonctionnement sur plusieurs années.",
      eligibilityNotes:
        "Pertinent pour des organismes artistiques admissibles déjà structurés. Ce n’est pas une subvention de campagne marketing, mais elle peut soutenir le fonctionnement global et donc indirectement des dépenses liées au rayonnement et aux communications.",
      applicationNotes:
        "Le scan doit confirmer le programme ou la composante réellement ouverte et conserver le lien détaillé du CAC.",
      applicantTypes: ["OBNL", "Organisme culturel"],
      sectors: ["culture", "arts", "developpement organisationnel", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["fonctionnement", "communications", "rayonnement", "developpement organisationnel"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon l’organisme",
      maxCoveragePct: null,
      openStatusReason:
        "Programme officiel du CAC pertinent pour la capacité organisationnelle; le statut courant doit être validé selon la composante et le calendrier officiel.",
    },
  },
  {
    name: "Québec - Mécénat Placements Culture",
    url: "https://www.quebec.ca/culture/aide-financiere/mecenat-culture",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Programme officiel du Québec pour l’autonomie financière des OBNL des domaines de la culture et des communications.",
    fallbackPayload: {
      name: "Québec - Mécénat Placements Culture",
      organization: "Gouvernement du Québec",
      summary:
        "Programme québécois destiné aux organismes à but non lucratif des domaines de la culture et des communications pour soutenir leur autonomie financière et leurs collectes de fonds.",
      officialUrl: "https://www.quebec.ca/culture/aide-financiere/mecenat-culture/programme-mecenat-placements-culture",
      seedType: "program",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "OPEN",
      confidence: 84,
      details:
        "Le programme vise explicitement les organismes à but non lucratif des domaines de la culture et des communications et accepte des demandes en continu selon Québec.ca.",
      eligibilityNotes:
        "Pertinent surtout pour des OBNL culturels ou en communications. Ce n’est pas un programme de branding direct, mais il soutient la capacité financière et les campagnes de financement, ce qui peut cadrer avec un mandat de structuration de marque ou de rayonnement dans une stratégie plus large.",
      applicationNotes:
        "Québec.ca indique qu’une demande peut être déposée en tout temps. Le scan peut donc le traiter comme ouvert tant qu’aucun avis officiel contraire n’est publié.",
      applicantTypes: ["OBNL", "Organisme culturel"],
      sectors: ["communications", "culture", "developpement organisationnel", "rayonnement"],
      projectStages: ["developpement"],
      eligibleExpenses: ["collecte de fonds", "developpement organisationnel", "communications"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le volet",
      maxCoveragePct: null,
      openStatusReason:
        "La page officielle Québec.ca mentionne qu’une demande d’aide financière peut être déposée en tout temps au cours de l’année.",
      intakeWindow: {
        rolling: true,
      },
    },
  },
  {
    name: "Québec - Aide aux initiatives de partenariat",
    url: "https://www.quebec.ca/culture/aide-financiere/initiatives-de-partenariat/aide-aux-initiatives-de-partenariat",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Programme officiel du Québec pour des ententes et projets structurants en culture et communications.",
    fallbackPayload: {
      name: "Québec - Aide aux initiatives de partenariat",
      organization: "Gouvernement du Québec",
      summary:
        "Programme québécois qui vise à soutenir le développement de la culture et des communications par la concertation et des initiatives partenariales.",
      officialUrl:
        "https://www.quebec.ca/culture/aide-financiere/initiatives-de-partenariat/aide-aux-initiatives-de-partenariat",
      seedType: "program",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "REVIEW",
      confidence: 74,
      details:
        "Cette aide est pertinente pour des projets partenariaux et structurants pouvant inclure du rayonnement, des communications, des contenus ou des outils de développement du milieu.",
      eligibilityNotes:
        "Le fit exact dépend du partenaire visé et de la nature du projet. Elle peut mieux convenir à des démarches concertées qu’à un mandat isolé de production.",
      applicationNotes:
        "Le scan doit identifier si un appel, une entente ou un volet actif est publié sur la page officielle et en extraire les dates.",
      applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
      sectors: ["communications", "culture", "rayonnement", "partenariat"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["communications", "rayonnement", "contenu numerique", "mediation"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le partenariat",
      maxCoveragePct: null,
      openStatusReason:
        "La page officielle confirme l’existence du programme; le statut actif doit être vérifié à partir de l’appel ou de l’entente en vigueur.",
    },
  },
  {
    name: "Québec - Aide au fonctionnement pour les organismes de regroupement",
    url: "https://www.quebec.ca/culture/aide-financiere/aide-au-fonctionnement/organismes-regroupement/programme-aide-au-fonctionnement-pour-les-organismes-de-regroupement-pafor",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Programme officiel du Québec pour les organismes de regroupement des milieux culturels et des communications.",
    fallbackPayload: {
      name: "Québec - Aide au fonctionnement pour les organismes de regroupement",
      organization: "Gouvernement du Québec",
      summary:
        "Programme québécois destiné aux organismes de regroupement qui offrent des services d’expertise-conseil, de communication, de regroupement, de formation et de développement.",
      officialUrl:
        "https://www.quebec.ca/culture/aide-financiere/aide-au-fonctionnement/organismes-regroupement/programme-aide-au-fonctionnement-pour-les-organismes-de-regroupement-pafor",
      seedType: "program",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "REVIEW",
      confidence: 80,
      details:
        "Ce programme est très pertinent pour la logique Essence de marque lorsqu’un regroupement cherche à renforcer ses communications, ses services à ses membres et son développement.",
      eligibilityNotes:
        "S’adresse à des personnes morales à but non lucratif comme des organismes de regroupement ou coopératives. Il ne vise pas tous les OBNL individuellement, mais c’est une source importante pour des mandats de communication et de développement au bénéfice d’un secteur.",
      applicationNotes:
        "Québec.ca indique une date de dépôt fermée pour l’édition 2025; le scan doit surveiller la prochaine ouverture annuelle plutôt que le traiter comme toujours ouvert.",
      applicantTypes: ["OBNL", "Cooperative", "Organisme de regroupement"],
      sectors: ["communications", "developpement organisationnel", "formation", "rayonnement"],
      projectStages: ["developpement"],
      eligibleExpenses: ["communications", "developpement organisationnel", "formation", "mutualisation"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le programme",
      maxCoveragePct: 100,
      openStatusReason:
        "La page officielle confirme le programme, mais Québec.ca indique que la période de dépôt 2025 est terminée; l’ouverture de la prochaine édition doit être confirmée.",
    },
  },
  {
    name: "Québec - Aide au fonctionnement pour les organismes culturels d’action communautaire",
    url: "https://www.quebec.ca/culture/aide-financiere/aide-au-fonctionnement/aide-au-fonctionnement-pour-les-organismes-culturels-daction-communautaire",
    type: "OFFICIAL",
    governmentLevel: "Quebec",
    description: "Programme officiel du Québec pour les organismes culturels d’action communautaire.",
    fallbackPayload: {
      name: "Québec - Aide au fonctionnement pour les organismes culturels d’action communautaire",
      organization: "Gouvernement du Québec",
      summary:
        "Programme québécois destiné aux organismes culturels d’action communautaire afin de soutenir leur offre de services adaptée aux communautés et groupes qui rencontrent des obstacles à la participation culturelle.",
      officialUrl:
        "https://www.quebec.ca/culture/aide-financiere/aide-au-fonctionnement/aide-au-fonctionnement-pour-les-organismes-culturels-daction-communautaire",
      seedType: "program",
      governmentLevel: "Quebec",
      region: "Quebec",
      status: "CLOSED",
      confidence: 90,
      details:
        "Programme particulièrement pertinent pour des OBNL culturels ou communautaires qui misent sur l’accessibilité, la médiation, la participation et le rayonnement auprès de publics ciblés. La page officielle indique que la période de dépôt s’est terminée le 27 juin 2025.",
      eligibilityNotes:
        "Convient aux organismes culturels d’action communautaire. Peut mieux cadrer avec des livrables de contenu, narration, image de marque et diffusion lorsqu’ils s’inscrivent dans l’offre de services et la participation culturelle de l’organisme.",
      applicationNotes:
        "Au 16 mars 2026, ce programme doit être considéré fermé tant qu’une nouvelle période de dépôt n’est pas publiée officiellement sur Québec.ca.",
      applicantTypes: ["OBNL", "Organisme culturel", "Organisme communautaire"],
      sectors: ["culture", "participation culturelle", "mediation", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["fonctionnement", "communications", "mediation", "rayonnement"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le programme",
      maxCoveragePct: null,
      openStatusReason:
        "La page officielle Québec.ca indique explicitement que la période de dépôt s’est terminée le 27 juin 2025; le programme est fermé au 16 mars 2026.",
      intakeWindow: {
        rolling: false,
        closesAt: "2025-06-27T23:59:00.000Z",
      },
    },
  },
  {
    name: "Longueuil - Programmes d’aide financières aux ménages et organismes",
    url: "https://www.longueuil.quebec/fr/services/developpement-social/programmes-daide-financieres-aux-menages-et-organismes",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Portail officiel de la Ville de Longueuil pour les programmes d’aide destinés aux organismes et au développement social.",
    fallbackPayload: {
      name: "Longueuil - Programme de soutien au développement social",
      organization: "Ville de Longueuil",
      summary:
        "Programme municipal permettant aux organismes reconnus de réaliser des projets qui améliorent la qualité de vie de la population et renforcent la vitalité des communautés.",
      officialUrl:
        "https://www.longueuil.quebec/fr/services/developpement-social/programmes-daide-financieres-aux-menages-et-organismes",
      seedType: "portal",
      governmentLevel: "Municipal",
      region: "Montérégie",
      status: "REVIEW",
      confidence: 72,
      details:
        "Cette source est utile pour des OBNL communautaires, culturels ou sociaux qui souhaitent développer leur offre, leur visibilité locale ou leur capacité d’action sur le territoire de Longueuil.",
      eligibilityNotes:
        "Le programme vise des organismes reconnus par la Ville de Longueuil. Le fit exact dépend du volet actif et des priorités annuelles du développement social ou communautaire.",
      applicationNotes:
        "Le scan doit distinguer le programme, l’édition active et les dates de dépôt directement depuis la page officielle de Longueuil.",
      applicantTypes: ["OBNL", "Organisme communautaire", "Organisme culturel"],
      sectors: ["developpement social", "organismes", "rayonnement", "developpement organisationnel"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["communications", "rayonnement", "developpement organisationnel", "projet communautaire"],
      eligibleProfessionalServices: true,
      maxAmount: "Selon le programme",
      maxCoveragePct: null,
      openStatusReason:
        "Le portail officiel Longueuil est confirmé, mais l’ouverture du volet courant doit être relue sur la page active.",
    },
  },
  {
    name: "Ville de Saguenay - Programme de soutien aux projets spéciaux",
    url: "https://ville.saguenay.ca/activites-et-loisirs/arts-et-culture/projets-sp%C3%A9ciaux/programme-de-soutien-aux-projets-sp%C3%A9ciaux",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Programme officiel de la Ville de Saguenay pour des projets spéciaux en arts et culture.",
    fallbackPayload: {
      name: "Ville de Saguenay - Programme de soutien aux projets spéciaux",
      organization: "Ville de Saguenay",
      summary:
        "Programme municipal visant des initiatives culturelles collaboratives, participatives et de rayonnement, dans le cadre de l’Entente de développement culturel de Saguenay.",
      officialUrl:
        "https://ville.saguenay.ca/activites-et-loisirs/arts-et-culture/projets-sp%C3%A9ciaux/programme-de-soutien-aux-projets-sp%C3%A9ciaux",
      governmentLevel: "Municipal",
      region: "Saguenay-Lac-Saint-Jean",
      status: "CLOSED",
      confidence: 88,
      details:
        "La page officielle indique une ouverture le 1er décembre 2025 et une date limite d’inscription au dimanche 1er février 2026, avec des volets de médiation, rayonnement et accessibilité au public.",
      eligibilityNotes:
        "Pertinent pour des organismes culturels et communautaires, ainsi que des projets visant l’élargissement des publics et le rayonnement des artistes et des organisations de Saguenay.",
      applicationNotes:
        "Au 16 mars 2026, la date limite du 1er février 2026 est dépassée; l’appel doit être considéré fermé jusqu’à nouvelle publication officielle.",
      applicantTypes: ["OBNL", "Organisme culturel", "Organisme communautaire"],
      sectors: ["culture", "mediation", "rayonnement", "participation culturelle"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["mediation", "rayonnement", "diffusion", "activite artistique"],
      maxAmount: "Selon le volet",
      maxCoveragePct: null,
      openStatusReason:
        "La page officielle Saguenay mentionne une date limite au 1er février 2026; le programme est traité comme fermé au 16 mars 2026.",
      intakeWindow: {
        rolling: false,
        opensAt: "2025-12-01T00:00:00.000Z",
        closesAt: "2026-02-01T23:59:00.000Z",
      },
    },
  },
  {
    name: "Montreal - Participation culturelle dans les quartiers",
    url: "https://montreal.ca/programmes/programme-participation-culturelle-dans-les-quartiers",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Programme officiel de la Ville de Montreal pour la participation culturelle.",
    fallbackPayload: {
      name: "Montreal - Participation culturelle dans les quartiers",
      organization: "Ville de Montreal",
      summary:
        "Programme municipal qui soutient des projets de participation culturelle, de mediation, de patrimoine et de creativite numerique dans les quartiers.",
      officialUrl: "https://montreal.ca/programmes/programme-participation-culturelle-dans-les-quartiers",
      governmentLevel: "Municipal",
      region: "Montreal",
      status: "REVIEW",
      confidence: 76,
      details:
        "Programme officiel particulierement pertinent pour les OBNL et organismes culturels qui veulent financer des projets de mediation, rayonnement, patrimoine ou creativite numerique.",
      eligibilityNotes:
        "La page officielle mentionne des OBNL, des cooperatives sans but lucratif et des organismes communautaires ou culturels. Certains projets de site Web ou de promotion pure ne sont pas admissibles.",
      applicationNotes:
        "La page officielle contient des volets, de l'aide financiere, des exclusions et des conditions par type d'organisme. Confirmer le volet et la date limite en vigueur avant depot.",
      applicantTypes: ["OBNL", "Organisme culturel", "Cooperative"],
      sectors: ["culture", "patrimoine", "creativite numerique", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["mediation", "rayonnement", "contenu culturel", "creativite numerique"],
      maxAmount: "Jusqu'a 90 000 $ selon le volet",
      maxCoveragePct: 85,
      openStatusReason: "Page officielle municipale detectee. Le statut final depend du volet en cours et de la date limite affichee.",
    },
  },
  {
    name: "Montreal - Soutien financier aux initiatives culturelles",
    url: "https://montreal.ca/programmes/programme-de-soutien-financier-aux-initiatives-culturelles",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Programme officiel d'arrondissement pour des initiatives culturelles a Montreal.",
    fallbackPayload: {
      name: "Montreal - Soutien financier aux initiatives culturelles",
      organization: "Ville de Montreal",
      summary:
        "Programme municipal qui soutient des initiatives culturelles locales en lien avec les priorites de developpement culturel.",
      officialUrl: "https://montreal.ca/programmes/programme-de-soutien-financier-aux-initiatives-culturelles",
      governmentLevel: "Municipal",
      region: "Montreal",
      status: "REVIEW",
      confidence: 68,
      details:
        "Volet municipal utile pour des organismes qui operent sur un territoire precis de Montreal et qui proposent des projets culturels ou de participation citoyenne.",
      eligibilityNotes:
        "Pertinent pour des organismes et projets locaux. Il faut verifier la geographie admissible, l'arrondissement vise et la nature exacte des depenses.",
      applicationNotes:
        "Le programme est officiel mais localise. Il faut lire les criteres d'admissibilite et les dates de depot sur la page du programme avant de le classer haut.",
      applicantTypes: ["OBNL", "Organisme culturel"],
      sectors: ["culture", "mediation", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["mediation", "animation culturelle", "rayonnement"],
      maxAmount: "Selon le programme",
      maxCoveragePct: null,
      openStatusReason: "Programme municipal officiel. A surveiller selon les appels actifs de l'arrondissement vise.",
    },
  },
  {
    name: "Ville de Quebec - Organismes culturels professionnels",
    url: "https://www.ville.quebec.qc.ca/apropos/programmes-subventions/art-culture/organismes-professionnels.aspx",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Portail officiel des programmes et subventions pour les organismes culturels professionnels de Quebec.",
    fallbackPayload: {
      name: "Ville de Quebec - Organismes culturels professionnels",
      organization: "Ville de Quebec",
      summary:
        "Portail officiel des programmes et subventions culturelles pour les organismes culturels professionnels a Quebec.",
      officialUrl: "https://www.ville.quebec.qc.ca/apropos/programmes-subventions/art-culture/organismes-professionnels.aspx",
      governmentLevel: "Municipal",
      region: "Quebec",
      status: "REVIEW",
      confidence: 66,
      details:
        "Page officielle de repertoire qui regroupe plusieurs appels et mesures de soutien municipaux en art, culture et patrimoine.",
      eligibilityNotes:
        "Pertinent pour des organismes culturels professionnels etablis a Quebec. Le scan doit descendre au sous-programme avant de conclure a l'ouverture.",
      applicationNotes:
        "Cette page est une porte d'entree officielle. Le lien direct final doit ensuite mener au sous-programme detecte, pas seulement a ce repertoir.",
      applicantTypes: ["OBNL", "Organisme culturel", "Artiste"],
      sectors: ["culture", "arts", "patrimoine", "audiovisuel"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["production", "rayonnement", "mediation", "creation"],
      maxAmount: "Selon le sous-programme",
      maxCoveragePct: null,
      openStatusReason: "Portail officiel municipal. Le statut final doit etre confirme sur le sous-programme actif.",
    },
  },
  {
    name: "Ville de Quebec - Animations estivales",
    url: "https://www.ville.quebec.qc.ca/apropos/programmes-subventions/art-culture/animations-estivales/",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Appel de propositions officiel pour les animations estivales a Quebec.",
    fallbackPayload: {
      name: "Ville de Quebec - Animations estivales",
      organization: "Ville de Quebec",
      summary:
        "Appel de propositions municipal pour des animations et prestations culturelles estivales a Quebec.",
      officialUrl: "https://www.ville.quebec.qc.ca/apropos/programmes-subventions/art-culture/animations-estivales/",
      governmentLevel: "Municipal",
      region: "Quebec",
      status: "CLOSED",
      confidence: 88,
      details:
        "Appel officiel destine aux organismes culturels professionnels qui souhaitent proposer des animations culturelles dans les parcs de Quebec pour la saison estivale 2026.",
      eligibilityNotes:
        "Programme municipal cible, principalement pour les organismes culturels professionnels et projets d'animation culturelle.",
      applicationNotes:
        "La page officielle indique une date limite au 30 janvier 2026. A la date actuelle du 16 mars 2026, cet appel doit etre considere ferme sauf nouvelle publication officielle.",
      applicantTypes: ["Organisme culturel", "OBNL"],
      sectors: ["culture", "animation culturelle", "rayonnement"],
      projectStages: ["diffusion"],
      eligibleExpenses: ["animation culturelle", "diffusion", "programmation"],
      maxAmount: "Selon l'appel",
      maxCoveragePct: null,
      openStatusReason: "La page officielle de la Ville de Quebec mentionne une date limite du 30 janvier 2026; l'appel est traite comme ferme au 16 mars 2026.",
      intakeWindow: {
        rolling: false,
        closesAt: "2026-01-30T23:59:00.000Z",
      },
    },
  },
  {
    name: "Ville de Laval - Soutien aux organismes culturels professionnels",
    url: "https://www.laval.ca/culture/soutien-artistes-organismes-culturels/soutien-professionnels/",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Programme officiel de la Ville de Laval pour les organismes culturels professionnels.",
    fallbackPayload: {
      name: "Ville de Laval - Soutien aux organismes culturels professionnels",
      organization: "Ville de Laval",
      summary:
        "Programme municipal de soutien au fonctionnement, aux projets et au rayonnement des organismes culturels professionnels lavallois.",
      officialUrl: "https://www.laval.ca/culture/soutien-artistes-organismes-culturels/soutien-professionnels/",
      governmentLevel: "Municipal",
      region: "Laval",
      status: "REVIEW",
      confidence: 78,
      details:
        "La page officielle de Laval regroupe plusieurs leviers réels: soutien annuel au fonctionnement, soutien à projet, résidence en arts de la scène et soutien promotionnel.",
      eligibilityNotes:
        "Le programme s'adresse aux organismes culturels professionnels admis au registre municipal. Certains volets couvrent le fonctionnement, d'autres des projets ou des résidences.",
      applicationNotes:
        "La page officielle affiche des formulaires, guides, pièces à joindre et des dates de tombée distinctes selon les volets. Le scan doit qualifier le volet actif avant de classer l'opportunité comme ouverte.",
      applicantTypes: ["OBNL", "Organisme culturel"],
      sectors: ["culture", "arts", "rayonnement", "médiation"],
      projectStages: ["développement", "production", "diffusion"],
      eligibleExpenses: ["fonctionnement", "projet culturel", "résidence", "promotion"],
      maxAmount: "Selon le volet",
      maxCoveragePct: 40,
      openStatusReason:
        "Page officielle municipale détaillée détectée. L'ouverture doit être confirmée au niveau du volet concerné et de sa date de tombée.",
    },
  },
  {
    name: "Ville de Sherbrooke - Appel de projets ponctuels pour les organismes culturels",
    url: "https://www.sherbrooke.ca/fr/culture-sports-et-loisirs/soutien-aux-organismes-culturels/appel-de-projets-ponctuels-pour-les-organismes-culturels",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Appel officiel de la Ville de Sherbrooke pour des projets ponctuels d'organismes culturels.",
    fallbackPayload: {
      name: "Ville de Sherbrooke - Appel de projets ponctuels pour les organismes culturels",
      organization: "Ville de Sherbrooke",
      summary:
        "Appel municipal destiné aux organismes culturels sherbrookois pour financer des projets ponctuels et des activités culturelles sur le territoire.",
      officialUrl:
        "https://www.sherbrooke.ca/fr/culture-sports-et-loisirs/soutien-aux-organismes-culturels/appel-de-projets-ponctuels-pour-les-organismes-culturels",
      governmentLevel: "Municipal",
      region: "Estrie",
      status: "REVIEW",
      confidence: 76,
      details:
        "La page officielle de Sherbrooke est un appel de projets ciblé pour les organismes culturels. Elle précise l'aide financière, l'admissibilité et la mécanique de dépôt.",
      eligibilityNotes:
        "Pertinent pour les organismes culturels reconnus ou actifs à Sherbrooke. La géographie admissible et le type d'activité doivent être relus directement sur l'appel en vigueur.",
      applicationNotes:
        "Le scan doit confirmer la date de dépôt annuelle et conserver le lien direct vers cet appel plutôt qu'un portail général de loisirs et culture.",
      applicantTypes: ["OBNL", "Organisme culturel"],
      sectors: ["culture", "diffusion", "animation culturelle"],
      projectStages: ["développement", "diffusion"],
      eligibleExpenses: ["projet culturel", "animation", "rayonnement"],
      maxAmount: "Selon l'appel",
      maxCoveragePct: null,
      openStatusReason:
        "Appel municipal officiel identifié. Le statut demeure à vérifier tant qu'une date de dépôt courante n'est pas extraite de la page.",
    },
  },
  {
    name: "Ville de Gatineau - Programme de soutien aux organismes culturels",
    url: "https://www.gatineau.ca/portail/default.aspx?c=fr-CA&p=guichet_municipal%2Fsubventions_commandites%2Fprogramme_soutien_organismes_culturels",
    type: "OFFICIAL",
    governmentLevel: "Municipal",
    description: "Programme officiel de la Ville de Gatineau pour soutenir les organismes culturels.",
    fallbackPayload: {
      name: "Ville de Gatineau - Programme de soutien aux organismes culturels",
      organization: "Ville de Gatineau",
      summary:
        "Programme municipal structurant qui soutient la mission, le développement, les événements et les projets des organismes culturels gatinois.",
      officialUrl:
        "https://www.gatineau.ca/portail/default.aspx?c=fr-CA&p=guichet_municipal%2Fsubventions_commandites%2Fprogramme_soutien_organismes_culturels",
      governmentLevel: "Municipal",
      region: "Outaouais",
      status: "REVIEW",
      confidence: 81,
      details:
        "La page officielle décrit le PSOC modernisé de Gatineau, ses volets, les maximums annuels, les organismes admissibles et les guides téléchargeables.",
      eligibilityNotes:
        "Le programme s'adresse aux organismes culturels gatinois, OBNL ou coopératives de solidarité, dans les domaines des arts, de la culture, de la littérature et du patrimoine.",
      applicationNotes:
        "Le scan doit distinguer les volets mission, projets ou loisir culturel et confirmer les échéances courantes, car la page porte un programme structurant plutôt qu'un simple portail.",
      applicantTypes: ["OBNL", "Coopérative", "Organisme culturel"],
      sectors: ["culture", "patrimoine", "rayonnement", "développement organisationnel"],
      projectStages: ["développement", "production", "diffusion"],
      eligibleExpenses: ["fonctionnement", "projet culturel", "événement", "services municipaux"],
      maxAmount: "Jusqu'à 160 000 $ selon le volet",
      maxCoveragePct: 40,
      openStatusReason:
        "Programme municipal officiel confirmé. Les volets et dates doivent être relus à chaque scan pour classer correctement l'opportunité.",
    },
  },
  buildRegionalReviewSource({
    name: "MRC de Bécancour - Fonds culturels",
    url: "https://www.mrcbecancour.qc.ca/fonds-culturels",
    organization: "MRC de Bécancour",
    region: "Centre-du-Québec",
    description: "Page officielle des fonds culturels de la MRC de Bécancour.",
    summary:
      "Programme officiel de la MRC de Bécancour pour des projets culturels, patrimoniaux et de médiation sur le territoire.",
    details:
      "La page officielle de la MRC centralise ses fonds culturels et les appels associés pour organismes, municipalités et promoteurs locaux.",
    eligibilityNotes:
      "Pertinent pour des OBNL, organismes culturels, municipalités et partenaires actifs dans la MRC de Bécancour. L'admissibilité exacte dépend du fonds ou du volet affiché.",
    applicationNotes:
      "Toujours relire la page officielle pour confirmer l'appel en cours, les documents à joindre et la date limite de dépôt.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "médiation", "rayonnement"],
    projectStages: ["développement", "production", "diffusion"],
    eligibleExpenses: ["médiation", "animation culturelle", "patrimoine", "rayonnement"],
    openStatusReason:
      "Source officielle MRC détectée. Les fenêtres de dépôt et les montants doivent être confirmés sur la page active du fonds.",
  }),
  buildRegionalReviewSource({
    name: "MRC de La Vallée-de-la-Gatineau - Développement culturel",
    url: "https://www.mrcvg.qc.ca/services/services-aux-citoyens/loisirs-et-sports/developpement-culturel/",
    organization: "MRC de La Vallée-de-la-Gatineau",
    region: "Outaouais",
    description: "Page officielle de développement culturel de la MRC de La Vallée-de-la-Gatineau.",
    summary:
      "Source officielle de la MRC de La Vallée-de-la-Gatineau pour les appels de projets culturels et les initiatives de rayonnement local.",
    details:
      "La page officielle regroupe les appels liés au développement culturel, aux ententes culturelles et à la mobilisation des organismes sur le territoire.",
    eligibilityNotes:
      "Vise surtout les organismes, municipalités et porteurs de projets culturels établis dans la MRC de La Vallée-de-la-Gatineau.",
    applicationNotes:
      "La page doit être revue à chaque scan pour confirmer le guide applicable, les volets admissibles et les échéances.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "médiation", "patrimoine", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["animation culturelle", "médiation", "patrimoine", "rayonnement"],
    openStatusReason:
      "Page MRC officielle orientée appels de projets. Le statut reste à confirmer tant que la date annuelle n'est pas explicitement détectée.",
  }),
  buildRegionalReviewSource({
    name: "MRC Pontiac - Fonds culturel",
    url: "https://mrcpontiac.qc.ca/entreprises/soutien-et-financement/fonds-culturel/",
    organization: "MRC Pontiac",
    region: "Outaouais",
    description: "Fonds culturel officiel de la MRC Pontiac.",
    summary:
      "Programme officiel de soutien culturel de la MRC Pontiac pour projets artistiques, patrimoniaux et de développement territorial.",
    details:
      "La page officielle du Fonds culturel de la MRC Pontiac sert de point d'entrée vers les appels de projets et les modalités de dépôt du territoire.",
    eligibilityNotes:
      "Peut convenir aux OBNL, organismes culturels, municipalités et partenaires locaux du Pontiac selon le volet actif.",
    applicationNotes:
      "Le scan doit confirmer les dates de l'édition courante et la documentation officielle affichée sur la page MRC.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "rayonnement", "développement territorial"],
    projectStages: ["développement", "production", "diffusion"],
    eligibleExpenses: ["médiation", "patrimoine", "animation culturelle", "rayonnement"],
    openStatusReason:
      "Lien direct vers un fonds culturel officiel MRC. Les modalités sont publiques mais l'ouverture doit être confirmée selon l'édition courante.",
  }),
  buildRegionalReviewSource({
    name: "MRC de Portneuf - Fonds et programmes",
    url: "https://portneuf.ca/developpement-economique/fonds/",
    organization: "MRC de Portneuf",
    region: "Capitale-Nationale",
    description: "Portail officiel des fonds et programmes de la MRC de Portneuf.",
    summary:
      "Portail officiel de la MRC de Portneuf pour les fonds régionaux pouvant soutenir des organismes, initiatives collectives et projets culturels.",
    details:
      "Cette page centralise les fonds et programmes publics de la MRC, incluant des outils utiles pour des projets structurants, culturels ou de développement local.",
    eligibilityNotes:
      "Pertinent pour des organismes et initiatives implantés dans Portneuf. Le bon volet doit être confirmé selon le type de projet et le profil du demandeur.",
    applicationNotes:
      "La page agit comme portail d'entrée; il faut descendre au fonds officiel correspondant avant de conclure à une ouverture confirmée.",
    applicantTypes: ["OBNL", "Organisme communautaire", "Municipalité", "Entreprise"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "rayonnement", "médiation", "communications"],
    openStatusReason:
      "Portail officiel de programmes MRC. Le volet exact et la date de dépôt doivent être validés avant qualification finale.",
  }),
  buildRegionalReviewSource({
    name: "MRC du Granit - Culture",
    url: "https://www.mrcgranit.qc.ca/fr/documents-et-publications/culture/",
    organization: "MRC du Granit",
    region: "Estrie",
    description: "Section culture officielle de la MRC du Granit.",
    summary:
      "Page officielle de la MRC du Granit regroupant les outils et appels en culture, patrimoine et développement culturel.",
    details:
      "La section culture de la MRC du Granit sert de base officielle pour repérer les appels culturels et les documents du territoire.",
    eligibilityNotes:
      "Convient aux organismes culturels, OBNL et partenaires locaux actifs dans la MRC du Granit.",
    applicationNotes:
      "Le scan doit vérifier si un appel de projets ou un fonds de développement culturel est explicitement publié dans la section.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "médiation", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["médiation", "patrimoine", "animation culturelle", "rayonnement"],
    openStatusReason:
      "Section officielle MRC repérée. La page est valide, mais l'appel actif doit être confirmé avant de classer le programme comme ouvert.",
  }),
  buildRegionalReviewSource({
    name: "MRC d'Abitibi - Fonds culturel",
    url: "https://mrcabitibi.qc.ca/fr/services-aux-citoyens-et-aux-municipalites/fonds/fonds-culturel",
    organization: "MRC d'Abitibi",
    region: "Abitibi-Témiscamingue",
    description: "Fonds culturel officiel de la MRC d'Abitibi.",
    summary:
      "Fonds culturel officiel de la MRC d'Abitibi pour soutenir des projets artistiques, culturels et patrimoniaux sur le territoire.",
    details:
      "La page officielle présente le fonds culturel MRC et les informations de référence utiles pour les promoteurs locaux.",
    eligibilityNotes:
      "S'adresse surtout aux organismes, municipalités et promoteurs culturels actifs dans la MRC d'Abitibi.",
    applicationNotes:
      "La confirmation finale dépend des documents de l'édition en cours et de la présence d'une date limite sur la page officielle.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "rayonnement", "médiation"],
    projectStages: ["développement", "production", "diffusion"],
    eligibleExpenses: ["médiation", "animation culturelle", "patrimoine", "communications"],
    openStatusReason:
      "Le fonds culturel est officiellement documenté par la MRC. L'ouverture actuelle doit être confirmée par la publication active.",
  }),
  buildRegionalReviewSource({
    name: "MRC de Drummond - Fonds et programmes",
    url: "https://www.mrcdrummond.qc.ca/fonds-et-programmes/",
    organization: "MRC de Drummond",
    region: "Centre-du-Québec",
    description: "Portail officiel des fonds et programmes de la MRC de Drummond.",
    summary:
      "Portail officiel des fonds et programmes de la MRC de Drummond, pertinent pour des projets collectifs, culturels et de développement des organismes.",
    details:
      "La page recense plusieurs leviers publics de la MRC de Drummond et peut orienter vers des appels en culture, initiatives structurantes et soutien local.",
    eligibilityNotes:
      "Pertinent pour des OBNL, organismes culturels, municipalités ou partenaires de la MRC selon le volet ciblé.",
    applicationNotes:
      "Le scan doit identifier le sous-programme officiel correspondant et confirmer sa date avant de qualifier le dossier comme ouvert.",
    applicantTypes: ["OBNL", "Organisme communautaire", "Organisme culturel", "Municipalité"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "rayonnement", "médiation", "communications"],
    openStatusReason:
      "Portail officiel MRC bien identifié. L'admissibilité et la date dépendent du sous-programme réellement visé.",
  }),
  buildRegionalReviewSource({
    name: "MRC de La Haute-Côte-Nord - Fonds et programmes",
    url: "https://www.mrchcn.qc.ca/fr/services-aux-citoyens/fonds-et-programmes/",
    organization: "MRC de La Haute-Côte-Nord",
    region: "Côte-Nord",
    description: "Portail officiel des fonds et programmes de la MRC de La Haute-Côte-Nord.",
    summary:
      "Portail officiel regroupant les programmes et fonds de la MRC de La Haute-Côte-Nord pour des organismes, projets collectifs et initiatives culturelles.",
    details:
      "La page officielle réunit différents dispositifs MRC et sert de point de repérage pour les programmes territoriaux disponibles.",
    eligibilityNotes:
      "Utile pour des OBNL et organismes implantés sur le territoire, y compris des initiatives culturelles et structurantes.",
    applicationNotes:
      "La page portail doit être recoupée avec le sous-programme visé pour confirmer l'ouverture réelle et les exigences de dépôt.",
    applicantTypes: ["OBNL", "Organisme communautaire", "Organisme culturel", "Municipalité"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "rayonnement", "médiation", "communications"],
    openStatusReason:
      "Portail officiel MRC actif. Le lien est valide, mais le programme admissible précis doit encore être confirmé.",
  }),
  buildRegionalReviewSource({
    name: "MRC d'Argenteuil - Fonds et programmes",
    url: "https://argenteuil.qc.ca/fonds-et-programmes/",
    organization: "MRC d'Argenteuil",
    region: "Laurentides",
    description: "Portail officiel des fonds et programmes de la MRC d'Argenteuil.",
    summary:
      "Portail officiel de la MRC d'Argenteuil pour les fonds territoriaux, les initiatives structurantes et certains leviers utiles aux organismes.",
    details:
      "La page regroupe les programmes MRC et permet de repérer les outils de financement disponibles pour les projets collectifs et locaux.",
    eligibilityNotes:
      "Pertinent pour des organismes, OBNL, municipalités et promoteurs établis dans Argenteuil selon le fonds ou l'appel affiché.",
    applicationNotes:
      "Cette source doit être parcourue jusqu'au programme cible avant validation finale du statut et de la date de dépôt.",
    applicantTypes: ["OBNL", "Organisme communautaire", "Municipalité", "Entreprise"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "rayonnement", "communications", "médiation"],
    openStatusReason:
      "Portail officiel Argenteuil repéré. La page doit être qualifiée plus finement programme par programme.",
  }),
  buildRegionalReviewSource({
    name: "MRC d'Abitibi-Ouest - Projets culturels",
    url: "https://developpement.mrcao.qc.ca/fr/programme-de-soutien-financier-aux-projets-culturels-de-l-abitibi-ouest",
    organization: "MRC d'Abitibi-Ouest",
    region: "Abitibi-Témiscamingue",
    description: "Programme officiel de soutien aux projets culturels de la MRC d'Abitibi-Ouest.",
    summary:
      "Programme officiel de la MRC d'Abitibi-Ouest pour soutenir des projets culturels sur le territoire.",
    details:
      "La page programme décrit un soutien financier dédié aux projets culturels de l'Abitibi-Ouest avec une portée territoriale claire.",
    eligibilityNotes:
      "Convient à des organismes, OBNL, artistes ou partenaires locaux selon les conditions officielles du programme.",
    applicationNotes:
      "Le programme doit être revérifié à chaque scan pour confirmer si la fenêtre annuelle de dépôt est active ou non.",
    applicantTypes: ["OBNL", "Organisme culturel", "Artiste", "Municipalité"],
    sectors: ["culture", "création", "rayonnement", "patrimoine"],
    projectStages: ["développement", "production", "diffusion"],
    eligibleExpenses: ["création", "médiation", "animation culturelle", "rayonnement"],
    openStatusReason:
      "Programme officiel MRC très ciblé. Le lien est direct, mais la date et l'édition active doivent être relues sur la page au moment du scan.",
  }),
  buildRegionalReviewSource({
    name: "MRC des Maskoutains - Patrimoine et culture",
    url: "https://www.mrcmaskoutains.qc.ca/patrimoine",
    organization: "MRC des Maskoutains",
    region: "Montérégie",
    description: "Page officielle patrimoine et culture de la MRC des Maskoutains.",
    summary:
      "Page officielle de la MRC des Maskoutains qui regroupe ses leviers en patrimoine et culture, incluant des appels et soutiens culturels territoriaux.",
    details:
      "La page officielle agit comme point d'entrée pour les appels de projets et programmes culturels ou patrimoniaux diffusés par la MRC.",
    eligibilityNotes:
      "Pertinent pour les organismes culturels, OBNL, municipalités et partenaires du territoire des Maskoutains selon le volet affiché.",
    applicationNotes:
      "La page doit être revisitée à chaque scan pour confirmer la présence d'un appel actif et l'échéance officielle en vigueur.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "médiation", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["médiation", "patrimoine", "animation culturelle", "rayonnement"],
    openStatusReason:
      "Source officielle MRC repérée. Le programme exact et la date limite doivent être confirmés sur la page courante au moment du scan.",
  }),
  buildRegionalReviewSource({
    name: "MRC de Rocher-Percé - Fonds et programmes",
    url: "https://www.mrcrocherperce.qc.ca/fonds-et-programmes/",
    organization: "MRC de Rocher-Percé",
    region: "Gaspésie-Îles-de-la-Madeleine",
    description: "Portail officiel des fonds et programmes de la MRC de Rocher-Percé.",
    summary:
      "Portail officiel de la MRC de Rocher-Percé pour repérer des fonds territoriaux, culturels et de développement régional.",
    details:
      "La page officielle centralise plusieurs programmes territoriaux et peut mener à des mesures pertinentes pour les organismes et projets locaux.",
    eligibilityNotes:
      "Pertinent pour des OBNL, organismes culturels, municipalités et partenaires établis dans Rocher-Percé.",
    applicationNotes:
      "Le scan doit descendre au fonds ou programme cible afin de confirmer l'ouverture réelle, les pièces requises et la date limite.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité", "Entreprise"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "communications", "rayonnement", "médiation"],
    openStatusReason:
      "Portail officiel de programmes MRC. Le statut reste à vérifier tant que le sous-programme exact n'est pas confirmé.",
  }),
  buildRegionalReviewSource({
    name: "MRC de Coaticook - Fonds et programmes",
    url: "https://www.mrcdecoaticook.qc.ca/votre-mrc/votre-mrc-fonds-et-programmes.php",
    organization: "MRC de Coaticook",
    region: "Estrie",
    description: "Portail officiel des fonds et programmes de la MRC de Coaticook.",
    summary:
      "Portail officiel de la MRC de Coaticook pour les fonds et programmes territoriaux, dont certains leviers utiles aux organismes et projets culturels.",
    details:
      "La page officielle regroupe différents programmes locaux et constitue une base de veille pour les opportunités régionales de la MRC.",
    eligibilityNotes:
      "Convient à des OBNL, organismes culturels, municipalités et initiatives locales implantés dans la MRC de Coaticook.",
    applicationNotes:
      "La qualification finale dépend du programme cible repéré dans ce portail et de ses modalités propres.",
    applicantTypes: ["OBNL", "Organisme communautaire", "Organisme culturel", "Municipalité"],
    sectors: ["développement local", "culture", "organismes", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["projet structurant", "médiation", "rayonnement", "communications"],
    openStatusReason:
      "Portail officiel Coaticook détecté. Les informations utiles sont publiques, mais le programme exact doit encore être isolé.",
  }),
  buildRegionalReviewSource({
    name: "MRC du Fjord-du-Saguenay - Initiatives culturelles",
    url: "https://mrc-fjord.qc.ca/la-mrc/aide-financiere/programme-de-soutien-aux-initiatives-culturelles/",
    organization: "MRC du Fjord-du-Saguenay",
    region: "Saguenay-Lac-Saint-Jean",
    description: "Programme officiel de soutien aux initiatives culturelles de la MRC du Fjord-du-Saguenay.",
    summary:
      "Programme officiel de la MRC du Fjord-du-Saguenay pour soutenir des initiatives culturelles structurantes sur le territoire.",
    details:
      "La page programme décrit un soutien culturel territorial et sert de point d'entrée officiel pour les organismes et promoteurs de la MRC.",
    eligibilityNotes:
      "Pertinent pour des organismes culturels, OBNL, municipalités et partenaires locaux selon les conditions de l'édition active.",
    applicationNotes:
      "Le programme doit être revu à chaque scan pour confirmer si l'appel 2026 est effectivement publié et ouvert.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "médiation", "création", "rayonnement"],
    projectStages: ["développement", "production", "diffusion"],
    eligibleExpenses: ["création", "animation culturelle", "médiation", "rayonnement"],
    openStatusReason:
      "Programme officiel ciblé MRC. L'ouverture 2026 doit être confirmée sur la page avant tout classement comme programme ouvert.",
  }),
  buildRegionalReviewSource({
    name: "MRC de Memphrémagog - Culture",
    url: "https://www.mrcmemphremagog.com/culture-2",
    organization: "MRC de Memphrémagog",
    region: "Estrie",
    description: "Page officielle culture de la MRC de Memphrémagog.",
    summary:
      "Page officielle culture de la MRC de Memphrémagog servant à repérer les soutiens et appels culturels du territoire.",
    details:
      "La section culture de la MRC rassemble les références utiles pour la médiation, le patrimoine et les programmes culturels territoriaux.",
    eligibilityNotes:
      "Peut convenir à des organismes culturels, OBNL et municipalités du territoire de Memphrémagog selon le programme ciblé.",
    applicationNotes:
      "Le scan doit confirmer si la page affiche une édition active ou redirige vers un appel annuel fermé ou à venir.",
    applicantTypes: ["OBNL", "Organisme culturel", "Municipalité"],
    sectors: ["culture", "patrimoine", "médiation", "rayonnement"],
    projectStages: ["développement", "diffusion"],
    eligibleExpenses: ["médiation", "patrimoine", "animation culturelle", "rayonnement"],
    openStatusReason:
      "Section officielle culture MRC. La présence d'un appel actif doit être confirmée par lecture directe de la page officielle.",
  }),
];
