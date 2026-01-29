import { Router } from "express";
import smartLinks from "./smart-links.js";
// legacy routers (products/groups/checkouts) are no longer mounted after schema simplification
// keep files in repo if you need to refer or migrate data, but they aren't used by the API router
import overview from "./overview.js";
import auth from "./auth.js";
import campaigns from "./campaigns.js";
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
router.use("/campaigns", campaigns);
// legacy routes (products/groups/checkouts) removed after schema simplification
// router.use("/products", products);
// router.use("/groups", groups);
// router.use("/checkouts", checkouts);
import endpoints from "./endpoints.js";
router.use("/endpoints", endpoints);
router.use("/smart-links", smartLinks);

export default router;
