const { z } = require('zod');

const loginSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
});

const registerSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    name: z.string().max(255).optional(),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema };
