// src/routes/document.routes.js
import express from "express";
import { fetchDocument } from "../controllers/document.controller.js";

const router = express.Router();

router.get("/document", fetchDocument);

export default router;