import { z } from "zod";

export const aiProgramAnalysisSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "REVIEW"]).nullable(),
  statusReason: z.string().nullable(),
  closesAt: z.string().nullable(),
  opensAt: z.string().nullable(),
  rolling: z.boolean().nullable(),
  organization: z.string().nullable(),
  summary: z.string().nullable(),
  maxAmount: z.string().nullable(),
  maxCoveragePct: z.number().nullable(),
  applicantTypes: z.array(z.string()).nullable(),
  sectors: z.array(z.string()).nullable(),
  projectStages: z.array(z.string()).nullable(),
  eligibleExpenses: z.array(z.string()).nullable(),
  eligibilityNotes: z.string().nullable(),
  applicationNotes: z.string().nullable(),
  details: z.string().nullable(),
  confidence: z.number().min(0).max(100).nullable(),
});

export type AiProgramAnalysis = z.infer<typeof aiProgramAnalysisSchema>;
