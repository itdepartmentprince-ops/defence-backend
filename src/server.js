
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`Server Running on Port ${PORT}`);
        });

        connectDB().catch((err) => {
            console.error("Initial DB connection failed:", err.message);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
