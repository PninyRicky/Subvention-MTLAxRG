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
  "mrcdescollinesdeloutaouais.qc.ca",
  "www.mrcdescollinesdeloutaouais.qc.ca",
]);

const blockedThirdPartyHosts = new Set([
  "hellodarwin.com",
  "www.hellodarwin.com",
]);

export function isOfficialInstitutionUrl(candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  try {
    const hostname = new URL(candidate).hostname.toLowerCase();

    if (blockedThirdPartyHosts.has(hostname)) {
      return false;
    }

    if (officialInstitutionHosts.has(hostname)) {
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
      sectors: ["marketing numerique", "branding", "rayonnement", "communications"],
      projectStages: ["developpement", "production", "diffusion"],
      eligibleExpenses: ["branding", "photo", "video", "site web", "marketing"],
      excludedKeywords: ["capital", "immobilier lourd"],
    },
    weights: {
      serviceFit: 30,
      applicantFit: 25,
      geographyFit: 10,
      expenseFit: 20,
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
    name: "MRC des Collines - Culture",
    url: "https://mrcdescollinesdeloutaouais.qc.ca/nos-services/culture/",
    type: "OFFICIAL",
    governmentLevel: "Regional",
    description: "Page officielle culture de la MRC des Collines-de-l'Outaouais.",
    fallbackPayload: {
      name: "MRC des Collines - Fonds de developpement culturel",
      organization: "MRC des Collines-de-l'Outaouais",
      summary:
        "Appel de projets culturel regional issu de l'entente de developpement culturel de la MRC des Collines-de-l'Outaouais.",
      officialUrl: "https://mrcdescollinesdeloutaouais.qc.ca/nos-services/culture/",
      governmentLevel: "Regional",
      region: "Outaouais",
      status: "REVIEW",
      confidence: 70,
      details:
        "Source regionale officielle qui mentionne un Fonds de developpement culturel et des appels de projets pour organisations et municipalites du territoire.",
      eligibilityNotes:
        "Pertinent pour les organismes et municipalites de la MRC ayant des projets culturels ou patrimoniaux. L'admissibilite exacte depend de l'appel annuel.",
      applicationNotes:
        "La page officielle doit etre revue a chaque scan pour confirmer l'edition en cours, le guide et la date limite de depot.",
      applicantTypes: ["OBNL", "Municipalite", "Organisme culturel"],
      sectors: ["culture", "patrimoine", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["mediation", "patrimoine", "animation culturelle", "rayonnement"],
      maxAmount: "Selon l'appel",
      maxCoveragePct: null,
      openStatusReason: "Source officielle regionale. La page mentionne un appel de projets, mais la date exacte doit etre confirmee au moment du scan.",
    },
  },
  {
    name: "MRC des Collines - Soutien aux organismes",
    url: "https://mrcdescollinesdeloutaouais.qc.ca/nos-services/developpement-social/",
    type: "OFFICIAL",
    governmentLevel: "Regional",
    description: "Page officielle de soutien aux organismes de la MRC des Collines-de-l'Outaouais.",
    fallbackPayload: {
      name: "MRC des Collines - Soutien aux organismes",
      organization: "MRC des Collines-de-l'Outaouais",
      summary:
        "Page officielle qui oriente les OBNL et organismes vers des fonds structurants, culturels et de developpement local sur le territoire.",
      officialUrl: "https://mrcdescollinesdeloutaouais.qc.ca/nos-services/developpement-social/",
      governmentLevel: "Regional",
      region: "Outaouais",
      status: "REVIEW",
      confidence: 64,
      details:
        "Source officielle interessante pour le scenario OBNL, car elle mentionne explicitement l'accompagnement des organismes et l'acces potentiel au Fonds regions et ruralite ainsi qu'au Fonds de developpement culturel.",
      eligibilityNotes:
        "S'adresse surtout aux organismes du territoire. Le fit est fort pour des projets structurants, culturels ou d'economie sociale portes localement.",
      applicationNotes:
        "La page n'affiche pas necessairement une date limite a elle seule; elle doit servir a reperer le bon fonds officiel ou a declencher une verification humaine.",
      applicantTypes: ["OBNL", "Organisme communautaire"],
      sectors: ["developpement social", "culture", "rayonnement"],
      projectStages: ["developpement", "diffusion"],
      eligibleExpenses: ["accompagnement", "projet structurant", "rayonnement", "mediation"],
      maxAmount: "Selon le fonds",
      maxCoveragePct: null,
      openStatusReason: "Source officielle regionale utile pour reperer des fonds publics, mais la date et le programme exacts doivent etre confirmes sur l'appel cible.",
    },
  },
];
