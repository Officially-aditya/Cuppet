import { z } from "zod";
import {
  hasForbiddenTextControls,
  isPromptInjectionAttempt,
  normalizeSecurityText
} from "./prompt-guard.js";

type TextSchemaOptions = {
  field: string;
  min: number;
  max: number;
  rejectPromptInjection?: boolean;
};

export function validatedTextSchema(options: TextSchemaOptions) {
  return z
    .string({
      required_error: `${options.field} is required.`,
      invalid_type_error: `${options.field} must be text.`
    })
    .superRefine((value, context) => {
      if (hasForbiddenTextControls(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.field} contains unsupported control characters.`
        });
      }
    })
    .transform(normalizeSecurityText)
    .pipe(
      z
        .string()
        .min(options.min, `${options.field} is too short.`)
        .max(options.max, `${options.field} is too long.`)
    )
    .superRefine((value, context) => {
      if (
        options.rejectPromptInjection !== false &&
        isPromptInjectionAttempt(value)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.field} contains instruction-override or secret-extraction patterns.`
        });
      }
    });
}

export const shortLabelSchema = validatedTextSchema({
  field: "Label",
  min: 1,
  max: 80,
  rejectPromptInjection: true
});

export const callbackSchemeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9+.-]*$/i, "Invalid callback scheme.");

export const cronSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) => /^(?:[\d*/?,\-]+\s+){4}[\d*/?,\-]+$/.test(value),
    "Invalid five-field cron schedule."
  );

export function hasSecurityValidationIssue(error: z.ZodError): boolean {
  return error.issues.some(
    (issue) =>
      issue.message.includes("instruction-override") ||
      issue.message.includes("control characters")
  );
}
