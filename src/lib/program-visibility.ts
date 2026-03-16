import { Prisma } from "@prisma/client";

export const MIN_VISIBLE_PROGRAM_SCORE = 55;

export function buildVisibleProgramWhere(): Prisma.FundingProgramWhereInput {
  return {
    matchResults: {
      some: {
        score: {
          gte: MIN_VISIBLE_PROGRAM_SCORE,
        },
      },
    },
  };
}
