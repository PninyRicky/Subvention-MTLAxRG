import { isOfficialInstitutionUrl } from "@/lib/source-registry";

type CheckedLink = {
  url: string;
  ok: boolean;
  status: number | null;
  finalUrl: string;
  bodyText?: string;
};

const LINK_TIMEOUT_MS = 6_000;
const LINK_REVALIDATE_SECONDS = 60 * 60 * 6;

async function requestLink(url: string, method: "HEAD" | "GET") {
  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    redirect: "follow",
    next: {
      revalidate: LINK_REVALIDATE_SECONDS,
    },
  });

  return response;
}

async function checkLink(url: string): Promise<CheckedLink> {
  if (!isOfficialInstitutionUrl(url)) {
    return { url, ok: false, status: null, finalUrl: url };
  }

  try {
    let response = await requestLink(url, "HEAD");
    let bodyText: string | undefined;

    if (response.status === 405 || response.status === 403) {
      response = await requestLink(url, "GET");
      bodyText = await response.text();
    } else if (!response.ok) {
      response = await requestLink(url, "GET");
      bodyText = await response.text();
    }

    const normalizedBody = bodyText
      ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const looksLikeMissingPage =
      Boolean(normalizedBody) &&
      [
        "page non trouvee",
        "page non trouvée",
        "pas trouve",
        "pas trouvé",
        "erreur 404",
        "404",
        "deplacee ou supprimee",
        "déplacée ou supprimée",
      ].some((pattern) => normalizedBody?.includes(pattern));

    if (
      (response.ok || (response.status >= 300 && response.status < 400) || response.status === 403) &&
      !looksLikeMissingPage
    ) {
      return {
        url,
        ok: true,
        status: response.status,
        finalUrl: response.url,
        bodyText: normalizedBody,
      };
    }

    return {
      url,
      ok: false,
      status: response.status,
      finalUrl: response.url,
      bodyText: normalizedBody,
    };
  } catch {
    return { url, ok: false, status: null, finalUrl: url };
  }
}

async function findNearestWorkingOfficialAncestor(url: string) {
  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    while (segments.length > 1) {
      segments.pop();
      parsedUrl.pathname = `/${segments.join("/")}/`;
      const candidateUrl = parsedUrl.toString();
      const checked = await checkLink(candidateUrl);

      if (checked.ok) {
        return checked;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveWorkingOfficialUrls(options: {
  officialUrl: string;
  sourceLandingUrl?: string | null;
  sourceUrl: string;
}) {
  const directCheck = await checkLink(options.officialUrl);

  if (directCheck.ok) {
    return {
      officialUrl: directCheck.finalUrl,
      sourceLandingUrl: options.sourceLandingUrl ?? options.sourceUrl,
      directOfficialUrlValid: true,
      directOfficialUrlStatus: directCheck.status,
    };
  }

  const candidates = Array.from(
    new Set([options.sourceLandingUrl ?? null, options.sourceUrl].filter(Boolean) as string[]),
  );

  for (const candidate of candidates) {
    const checked = await checkLink(candidate);

    if (checked.ok) {
      return {
        officialUrl: checked.finalUrl,
        sourceLandingUrl: checked.finalUrl,
        directOfficialUrlValid: false,
        directOfficialUrlStatus: directCheck.status,
      };
    }
  }

  const ancestor = await findNearestWorkingOfficialAncestor(options.officialUrl);
  if (ancestor?.ok) {
    return {
      officialUrl: ancestor.finalUrl,
      sourceLandingUrl: ancestor.finalUrl,
      directOfficialUrlValid: false,
      directOfficialUrlStatus: directCheck.status,
    };
  }

  return {
    officialUrl: options.sourceUrl,
    sourceLandingUrl: options.sourceLandingUrl ?? options.sourceUrl,
    directOfficialUrlValid: false,
    directOfficialUrlStatus: directCheck.status,
  };
}
