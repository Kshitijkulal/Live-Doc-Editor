import express from "express";
import cors from "cors";
import documentRoutes from "./routes/document.routes.js";
import helmet from "helmet";
import { httpLogger } from "./middleware/logger.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(httpLogger);

// API routes
app.use("/api", documentRoutes);

// health check
app.get("/", (req, res) => {
  res.send("API running");
});

export default app;