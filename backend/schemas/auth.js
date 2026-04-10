const { z } = require('zod');

const loginSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(1).max(128),
});

const registerSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscore and hyphen'),
    password: z.string().min(8).max(128),
    name: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema };
