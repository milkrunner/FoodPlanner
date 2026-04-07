const { ZodError } = require('zod');

function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues.map(i => ({
                    path: i.path.join('.'),
                    message: i.message
                }))
            });
        }
        req.body = result.data;
        next();
    };
}

module.exports = { validate };
