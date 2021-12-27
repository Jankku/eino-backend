import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import Logger from "./util/logger";
import { errorResponder } from "./util/errorhandler";
import verifyToken from "./middleware/authorization";
import authRoutes from "./routes/authentication";
import listRoutes from "./routes/list";
import { pool } from "./db/config";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet());
app.use(cors({ allowedHeaders: ["Content-Type", "Authorization"] }));

app.use("/api/auth", authRoutes);
app.use("/api/list", verifyToken, listRoutes);

app.use(errorResponder);

app.listen(port, () => Logger.info(`Server Listening to port ${port}`));

process.on("uncaughtException", (err) => {
  Logger.error("uncaughtException", err);
  pool.end(() => Logger.info("Pool has ended"));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  Logger.error("unhandledRejection", reason);
});

export default app;
