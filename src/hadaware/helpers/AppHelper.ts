import { Request } from "express";
import fs from "fs";
import path from "path";

const redirects: Record<string, any> = {};
redirects.localhost = "orocampo";

class AppHelper {
    public static appName: string;

    public static getAppName(req?: Request): string {
        let appName;
        if (req) {
            appName = req.hostname.split(".")[0];
            appName = appName in redirects ? redirects[appName] : appName;
            AppHelper.appName = appName;
        } else if (AppHelper.appName) {
            appName = AppHelper.appName;
        } else {
            appName = "void";
        }

        return appName;
    }

    public static getScheme(appName?: string) {
        if (!appName) { appName = AppHelper.appName; }
        const schemePath = path.join(__dirname, "..", "..", "..", "assets", appName, "scheme.json");
        const schemeString = fs.readFileSync(schemePath, "utf8");
        const scheme = JSON.parse(schemeString);
        scheme.appName = appName;
        return scheme;
    }
}

export { AppHelper };
