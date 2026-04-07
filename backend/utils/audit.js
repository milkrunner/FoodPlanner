const db = require('../db');
const { logger } = require('./logger');

async function logAudit(req, action, targetType, targetId, details = null) {
    try {
        await db.query(
            `INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user?.id || null, action, targetType, targetId, details ? JSON.stringify(details) : null, req.ip]
        );
    } catch (error) {
        logger.error('Failed to write audit log', { error: error.message, action, component: 'audit' });
    }
}

module.exports = { logAudit };
