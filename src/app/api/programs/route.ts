import { Prisma, ProgramStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildVisibleProgramWhere } from "@/lib/program-visibility";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const level = searchParams.get("level");

  const programs = await prisma.fundingProgram.findMany({
    where: {
      ...buildVisibleProgramWhere(),
      ...(status && Object.values(ProgramStatus).includes(status as ProgramStatus)
        ? { status: status as ProgramStatus }
        : {}),
      ...(level ? { governmentLevel: level } : {}),
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                organization: {
                  contains: q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                summary: {
                  contains: q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    },
    include: {
      intakeWindows: true,
      matchResults: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json(programs);
}
