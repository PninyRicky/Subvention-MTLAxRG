import { ProgramStatus, SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { scoreProgramForProfile } from "@/lib/scoring";
import { defaultOfficialSources, defaultProfiles, isOfficialInstitutionUrl } from "@/lib/source-registry";
import { slugify } from "@/lib/utils";

async function removeUnofficialRecords() {
  const unofficialSources = await prisma.sourceRegistry.findMany({
    where: {
      OR: [
        { type: SourceType.AGGREGATOR },
        { url: { contains: "hellodarwin.com" } },
      ],
    },
    select: { id: true },
  });

  const unofficialSourceIds = unofficialSources.map((source) => source.id);

  if (unofficialSourceIds.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        sourceId: {
          in: unofficialSourceIds,
        },
      },
    });

    await prisma.sourceRegistry.deleteMany({
      where: {
        id: {
          in: unofficialSourceIds,
        },
      },
    });
  }

  const unofficialPrograms = await prisma.fundingProgram.findMany({
    where: {
      OR: [
        { officialUrl: { contains: "hellodarwin.com" } },
        { sourceLandingUrl: { contains: "hellodarwin.com" } },
      ],
    },
    select: { id: true },
  });

  if (unofficialPrograms.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        id: {
          in: unofficialPrograms.map((program) => program.id),
        },
      },
    });
  }

  const allPrograms = await prisma.fundingProgram.findMany({
    select: {
      id: true,
      officialUrl: true,
      sourceLandingUrl: true,
    },
  });

  const invalidProgramIds = allPrograms
    .filter(
      (program) =>
        !isOfficialInstitutionUrl(program.officialUrl) ||
        (program.sourceLandingUrl ? !isOfficialInstitutionUrl(program.sourceLandingUrl) : false),
    )
    .map((program) => program.id);

  if (invalidProgramIds.length > 0) {
    await prisma.fundingProgram.deleteMany({
      where: {
        id: {
          in: invalidProgramIds,
        },
      },
    });
  }
}

async function ensureSourcePrograms() {
  const sources = await prisma.sourceRegistry.findMany();
  const touchedPrograms: string[] = [];

  for (const source of sources) {
    const payload = source.fallbackPayload as Record<string, unknown> | null;

    if (!payload) {
      continue;
    }

    const slug = slugify(String(payload.name ?? source.name));
    const existing = await prisma.fundingProgram.findUnique({
      where: { slug },
      select: { id: true },
    });
    const baseData = {
      slug,
      name: String(payload.name ?? source.name),
      organization: String(payload.organization ?? source.name),
      summary: String(payload.summary ?? source.description ?? ""),
      officialUrl: payload.officialUrl ? String(payload.officialUrl) : source.url,
      sourceLandingUrl: source.url,
      governmentLevel: String(payload.governmentLevel ?? source.governmentLevel ?? "A confirmer"),
      region: String(payload.region ?? "Quebec"),
      status: ProgramStatus[String(payload.status ?? "REVIEW") as keyof typeof ProgramStatus],
      confidence: Number(payload.confidence ?? 50),
      maxAmount: payload.maxAmount ? String(payload.maxAmount) : null,
      maxCoveragePct: payload.maxCoveragePct ? Number(payload.maxCoveragePct) : null,
      details: payload.details ? String(payload.details) : null,
      eligibilityNotes: payload.eligibilityNotes ? String(payload.eligibilityNotes) : null,
      applicationNotes: payload.applicationNotes ? String(payload.applicationNotes) : null,
      applicantTypes: Array.isArray(payload.applicantTypes) ? (payload.applicantTypes as string[]) : [],
      sectors: Array.isArray(payload.sectors) ? (payload.sectors as string[]) : [],
      projectStages: Array.isArray(payload.projectStages) ? (payload.projectStages as string[]) : [],
      eligibleExpenses: Array.isArray(payload.eligibleExpenses) ? (payload.eligibleExpenses as string[]) : [],
      openStatusReason: payload.openStatusReason ? String(payload.openStatusReason) : null,
      sourceId: source.id,
      lastVerifiedAt: new Date(),
    };

    if (existing) {
      await prisma.fundingProgram.update({
        where: { id: existing.id },
        data: baseData,
      });

      touchedPrograms.push(existing.id);
    } else {
      const createdProgram = await prisma.fundingProgram.create({
        data: {
          ...baseData,
          intakeWindows: {
            create: payload.intakeWindow
              ? {
                  rolling: Boolean((payload.intakeWindow as Record<string, unknown>).rolling),
                  opensAt: (payload.intakeWindow as Record<string, unknown>).opensAt
                    ? new Date(String((payload.intakeWindow as Record<string, unknown>).opensAt))
                    : null,
                  closesAt: (payload.intakeWindow as Record<string, unknown>).closesAt
                    ? new Date(String((payload.intakeWindow as Record<string, unknown>).closesAt))
                    : null,
                  lastConfirmedAt: new Date(),
                }
              : undefined,
          },
        },
      });

      touchedPrograms.push(createdProgram.id);
    }

    if (payload.intakeWindow) {
      await prisma.intakeWindow.deleteMany({
        where: {
          programId: existing?.id ?? touchedPrograms[touchedPrograms.length - 1],
        },
      });

      await prisma.intakeWindow.create({
        data: {
          programId: existing?.id ?? touchedPrograms[touchedPrograms.length - 1],
          rolling: Boolean((payload.intakeWindow as Record<string, unknown>).rolling),
          opensAt: (payload.intakeWindow as Record<string, unknown>).opensAt
            ? new Date(String((payload.intakeWindow as Record<string, unknown>).opensAt))
            : null,
          closesAt: (payload.intakeWindow as Record<string, unknown>).closesAt
            ? new Date(String((payload.intakeWindow as Record<string, unknown>).closesAt))
            : null,
          lastConfirmedAt: new Date(),
        },
      });
    }
  }

  if (touchedPrograms.length === 0) {
    return;
  }

  const [profiles, programs] = await Promise.all([
    prisma.serviceProfile.findMany(),
    prisma.fundingProgram.findMany({
      where: {
        id: {
          in: touchedPrograms,
        },
      },
      include: {
        intakeWindows: true,
      },
    }),
  ]);

  for (const profile of profiles) {
    for (const program of programs) {
      const result = scoreProgramForProfile(program, profile);

      await prisma.matchResult.upsert({
        where: {
          programId_profileId: {
            programId: program.id,
            profileId: profile.id,
          },
        },
        update: result,
        create: {
          ...result,
          programId: program.id,
          profileId: profile.id,
        },
      });
    }
  }
}

export async function ensureBootstrapped() {
  const profileCount = await prisma.serviceProfile.count();

  if (profileCount === 0) {
    await prisma.serviceProfile.createMany({
      data: defaultProfiles,
    });
  }

  await removeUnofficialRecords();

  for (const source of defaultOfficialSources) {
    await prisma.sourceRegistry.upsert({
      where: {
        url: source.url,
      },
      update: source,
      create: source,
    });
  }

  await ensureSourcePrograms();
}
