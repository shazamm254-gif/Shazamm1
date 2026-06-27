import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const forgotSchema = z.object({
  email: z.string().email().max(200),
});

export const resetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
});

export const companySchema = z.object({
  name: z.string().min(1).max(160),
  website: z.string().max(200).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  services: z.string().max(4000).optional().or(z.literal("")),
  tone: z.string().max(80).optional().or(z.literal("")),
  valueProps: z.string().max(2000).optional().or(z.literal("")),
  defaultCurrency: z.string().min(3).max(3).default("USD"),
});

export const generateSchema = z.object({
  brief: z.string().min(10).max(8000),
  clientName: z.string().max(160).optional().or(z.literal("")),
  clientCompany: z.string().max(160).optional().or(z.literal("")),
  title: z.string().max(200).optional().or(z.literal("")),
});

const pricingItemSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().nonnegative(),
});

const sectionSchema = z.object({
  heading: z.string().max(200),
  body: z.string().max(8000),
});

export const updateProposalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  clientName: z.string().max(160).optional().or(z.literal("")),
  clientCompany: z.string().max(160).optional().or(z.literal("")),
  status: z.enum(["draft", "sent", "accepted", "declined"]).optional(),
  content: z
    .object({
      summary: z.string().max(4000),
      sections: z.array(sectionSchema).max(20),
      pricing: z.array(pricingItemSchema).max(50),
      currency: z.string().max(8),
      total: z.number().nonnegative(),
    })
    .optional(),
});

export const acceptSchema = z.object({
  acceptedBy: z.string().min(1).max(160),
});

// Only client-observable events may be sent from the browser.
export const trackSchema = z.object({
  type: z.enum(["page_view", "proposal_viewed"]),
  anonId: z.string().min(8).max(64),
  proposalId: z.string().max(64).optional(),
});
