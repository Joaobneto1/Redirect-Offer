import { Router } from "express";
import products from "./products.js";
import groups from "./groups.js";
import checkouts from "./checkouts.js";
import smartLinks from "./smart-links.js";
import overview from "./overview.js";

const router = Router();
router.use("/overview", overview);
router.use("/products", products);
router.use("/groups", groups);
router.use("/checkouts", checkouts);
router.use("/smart-links", smartLinks);

export default router;
