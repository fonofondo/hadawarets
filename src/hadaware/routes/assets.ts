import { Request, Response, Router } from "express";
import fs from "fs";
import { AppHelper } from "../helpers/AppHelper";

import createError from "http-errors";
import path from "path";

const routes = Router();

routes.get("*", (req: Request, res: Response, next) => {
  // req.baseUrl
  // req.hostname
  const appName = AppHelper.getAppName(req);
  const assetPath = path.join(__dirname, "..", "..", "..", "assets", appName, req.path);

  if (fs.existsSync(assetPath)) {
    res.sendFile(assetPath);
  } else {
    next(createError(404));
  }
});

export default routes;
