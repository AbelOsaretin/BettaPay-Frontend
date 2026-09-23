import { z } from "zod";

/**
 * Zod schema for bank settlement details (Issue #559).
 * Validates account numbers (10-digit NUBAN or 15–34 char IBAN) and bank codes (3-11 alphanumerics).
 */
export const accountNumberSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      const clean = val.replace(/\s+/g, "");
      const isNuban = /^\d{10}$/.test(clean);
      const isIban = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(clean);
      const isGenericAccount = /^\d{8,17}$/.test(clean);
      return isNuban || isIban || isGenericAccount;
    },
    {
      message:
        "Invalid account number or IBAN format. Account numbers must be 10 digits or valid IBAN (15–34 characters).",
    }
  );

export const bankCodeSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      return /^[a-zA-Z0-9]{3,11}$/.test(val);
    },
    {
      message: "Bank code must be 3–11 alphanumeric characters.",
    }
  );

export const bankDetailsSchema = z.object({
  accountNumber: accountNumberSchema,
  bankCode: bankCodeSchema,
  bankName: z.string().trim().optional(),
});

export type BankDetails = z.infer<typeof bankDetailsSchema>;

export const businessTypeSchema = z.enum(["individual", "business"], {
  errorMap: () => ({ message: "Business type must be either 'individual' or 'business'" })
});

export const webhookUrlSchema = z
  .string()
  .trim()
  .url({ message: "Enter a valid URL, including https://" })
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== "https:") return false;
        
        const hostname = parsed.hostname;
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "[::1]" ||
          hostname === "169.254.169.254" ||
          hostname.startsWith("192.168.") ||
          hostname.startsWith("10.") ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "URL must be HTTPS and cannot be a private IP or localhost.",
    }
  );
