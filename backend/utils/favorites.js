function resolveFavoriteFlagFromBody(body = {}, fallback = false) {
    if (typeof body.is_favorite === 'boolean') {
        return body.is_favorite;
    }

    if (typeof body.isFavorite === 'boolean') {
        return body.isFavorite;
    }

    return fallback;
}

function resolveToggleTarget(body = {}, currentValue = false) {
    if (typeof body.is_favorite === 'boolean') {
        return body.is_favorite;
    }

    if (typeof body.isFavorite === 'boolean') {
        return body.isFavorite;
    }

    return !currentValue;
}

module.exports = {
    resolveFavoriteFlagFromBody,
    resolveToggleTarget
};
