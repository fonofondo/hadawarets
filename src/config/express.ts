import express, {
  Application,
  json,
  Request,
  Response,
  urlencoded
} from "express";
import exphbs from "express-handlebars";
import { Server } from "http";
import path from "path";
import routesAPI from "../api/routes";
import { AppHelper } from "../hadaware/helpers/AppHelper";
import { FileHelper } from "../hadaware/helpers/FileHelper";
import assetsRouter from "../hadaware/routes/assets";

declare global {
  var appName: string;
}

function initExpress(): Server {
  const app: Application = express();

  // Set Template engine to handlebars
  app.engine("hbs", exphbs());
  app.set("view engine", "hbs");

  // Middleware
  app.use(json());
  app.use(urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, "..", "..", "public")));

  app.use((req: Request, res: Response, next) => {
    globalThis.appName = AppHelper.getAppName(req);
    next();
  });

  // Check API Health / Ping
  app.get("/", (req: Request, res: Response) => {
    return res.send("OK");
  });

  // Example Using Handlebars Template Engine
  // More info: https://handlebarsjs.com/
  app.get("/home", (req: Request, res: Response) => {
    return res.render("home", {
      contohText: "Lorem Ipsum mas bro",
      title: "Express Typescript"
    });
  });

  // Send all components
  app.get("/components.html", (req: Request, res: Response) => {
    const componentsString = FileHelper.getComponentsString(req);
    res.send(componentsString);
  });

  // Router V1
  app.use("/api", routesAPI);
  app.use("/assets", assetsRouter);

  // Init Express
  const PORT: string | number = process.env.PORT || 7070;
  return app.listen(
    PORT,
    () => console.log(`Server started on port ${PORT}`) // tslint:disable-line
  );
}

export default initExpress;
