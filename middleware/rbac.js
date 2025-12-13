const checkRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ msg: `Access denied. Only ${role}s can perform this action.` });
        }
        next();
    };
};

module.exports = { checkRole };
