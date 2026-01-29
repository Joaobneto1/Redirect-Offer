import { Router } from "express";
import products from "./products.js";
import groups from "./groups.js";
import checkouts from "./checkouts.js";
import smartLinks from "./smart-links.js";
import overview from "./overview.js";
import auth from "./auth.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.use((req, res, next) => {
  const skip =
    (req.path === "/auth/register" && req.method === "POST") ||
    (req.path === "/auth/login" && req.method === "POST");
  if (skip) return next();
  requireAuth(req, res, next);
});

router.use("/auth", auth);
router.use("/overview", overview);
router.use("/products", products);
router.use("/groups", groups);
router.use("/checkouts", checkouts);
router.use("/smart-links", smartLinks);

export default router;
