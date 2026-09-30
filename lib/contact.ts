import { z } from "zod";

export const ContactFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  message: z.string().trim().min(1).max(2000),
});

export type ContactFormValues = z.infer<typeof ContactFormSchema>;
