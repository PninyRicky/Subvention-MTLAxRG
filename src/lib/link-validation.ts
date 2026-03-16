import { isOfficialInstitutionUrl } from "@/lib/source-registry";

type CheckedLink = {
  url: string;
  ok: boolean;
};

async function requestLink(url: string, method: "HEAD" | "GET") {
  const response = await fetch(url, {
    method,
    headers: {
      "user-agent": "MTLA-Subventions/1.0 (+https://mtla.productions)",
    },
    redirect: "follow",
    next: {
      revalidate: 0,
    },
  });

  return response;
}

async function checkLink(url: string): Promise<CheckedLink> {
  if (!isOfficialInstitutionUrl(url)) {
    return { url, ok: false };
  }

  try {
    let response = await requestLink(url, "HEAD");

    if (response.status === 405 || response.status === 403) {
      response = await requestLink(url, "GET");
    }

    if (response.ok || (response.status >= 300 && response.status < 400) || response.status === 403) {
      return { url, ok: true };
    }

    return { url, ok: false };
  } catch {
    return { url, ok: false };
  }
}

export async function resolveWorkingOfficialUrls(options: {
  officialUrl: string;
  sourceLandingUrl?: string | null;
  sourceUrl: string;
}) {
  const candidates = Array.from(
    new Set([options.officialUrl, options.sourceLandingUrl ?? null, options.sourceUrl].filter(Boolean) as string[]),
  );

  for (const candidate of candidates) {
    const checked = await checkLink(candidate);

    if (checked.ok) {
      return {
        officialUrl: checked.url,
        sourceLandingUrl: options.sourceLandingUrl ?? options.sourceUrl,
      };
    }
  }

  return {
    officialUrl: options.sourceUrl,
    sourceLandingUrl: options.sourceLandingUrl ?? options.sourceUrl,
  };
}
