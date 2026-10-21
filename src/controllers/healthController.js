

const mongoose = require("mongoose");

const getHealth = (req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const dbState = states[mongoose.connection.readyState] || "unknown";

    res.json({
        success: true,
        message: "Defence Academy Backend is Running",
        database: {
            status: dbState,
            connected: mongoose.connection.readyState === 1,
        },
    });
};

module.exports = { getHealth };