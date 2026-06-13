import { z } from "zod";

const emailSchema = z.string().email({ message: "Invalid email address" });
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long" });

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signinSchema = signupSchema;

export type SignupSchema = z.infer<typeof signupSchema>;
export type SigninSchema = z.infer<typeof signinSchema>;
