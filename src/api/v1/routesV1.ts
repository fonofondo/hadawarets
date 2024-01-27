import { Request, Response, Router } from "express";
import fs from "fs";
import path from "path";
import { AppHelper } from "../../hadaware/helpers/AppHelper";
import { SyncHelper } from "../../hadaware/helpers/SyncHelper";
import { UserHelper } from "../../hadaware/helpers/UserHelper";
import userRoutes from "./module/user/delivery";

const routes = Router();

routes.get("/", async (req: Request, res: Response) => {
  res.send("This is route api version 1");
});

routes.post("/initLogin", (req: Request, res: Response) => {
  const user = req.body.user.trim();
  const password = req.body.password.trim();

  if (user === "orocampo" && password === "asdf") {
    res.send(UserHelper.getRootUserData());
  } else {
    res.send({error: true});
  }
});

routes.post("/sync", async (req: Request, res: Response) => {
  const result = await SyncHelper.fromClient(req);
  res.send(result);
});

routes.get("/scheme", (req: Request, res: Response) => {
  const appName = AppHelper.getAppName(req);
  const scheme = AppHelper.getScheme(appName);
  res.send(JSON.stringify(scheme));
});

routes.use("/users", userRoutes);

export default routes;
