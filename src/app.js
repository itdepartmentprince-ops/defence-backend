
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const healthRoutes = require("./Routes/healthRoute");
const contactRoutes = require("./Routes/contactRoutes");
const authRoutes = require("./Routes/authRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const galleryRoutes = require("./Routes/galleryRoutes");
const galleryCategoryRoutes = require("./Routes/galleryCategoryRoute");
const blogRoutes = require("./Routes/blogRoutes");
const blogCategoryRoutes = require("./Routes/blogCategoryRoutes");
const dashboardRoutes = require("./Routes/dashboardRoutes");
const passwordResetRoutes = require("./Routes/passwordResetRoutes");
const quizRoutes = require("./Routes/quizRoutes");
const analyticsRoutes = require("./Routes/analyticsRoutes");
const achieverRoutes = require("./Routes/achieverRoutes");
const achieverCategoryRoutes = require("./Routes/achieverCategoryRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");

const app = express();

const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://prince-defence-frontend.vercel.app",
    "https://prince-defence-admin.vercel.app",
    "https://princedefence.com",
    "https://www.princedefence.com",
];

const configuredOrigins = process.env.FRONTEND_ORIGINS
    ? process.env.FRONTEND_ORIGINS.split(",")
    : [];

const allowedOrigins = [...new Set([
    ...defaultOrigins,
    ...configuredOrigins,
])]
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin is not allowed by CORS"));
        },
        credentials: true,
        maxAge: 600,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/gallery-categories", galleryCategoryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/blog-categories", blogCategoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/forgot-password", passwordResetRoutes);
app.use("/api/achievers", achieverRoutes);
app.use("/api/achiever-categories", achieverCategoryRoutes);

app.use(errorMiddleware);

module.exports = app;
