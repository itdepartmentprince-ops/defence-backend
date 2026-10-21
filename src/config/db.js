const mongoose = require("mongoose");
const dns = require("dns");

// Configure reliable DNS servers to resolve MongoDB Atlas SRV records
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (e) {
    // Continue if environment restricts custom DNS servers
}

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.error("MongoDB Error: MONGODB_URI is not defined in environment variables!");
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 8000,
        });
        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);
    }
};

mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected. Reconnecting...");
});

mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
});

module.exports = connectDB;