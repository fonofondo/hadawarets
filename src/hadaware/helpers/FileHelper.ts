import { Request } from "express";
import fs from "fs";
import path from "path";
import { AppHelper } from "./AppHelper";

class FileHelper {
    public static getComponentsString(req: Request): string {
        const publicComponentsPath = path.join(__dirname, "..", "..", "..", "public", "components");
        const appComponentsPath = path.join(__dirname, "..", "..", "..",
                                    "assets", AppHelper.getAppName(req), "components");

        let concatenatedContent = FileHelper.readFilesInDirectory(publicComponentsPath);
        concatenatedContent += FileHelper.readFilesInDirectory(appComponentsPath);

        return concatenatedContent;
    }

    public static readFilesInDirectory(directoryPath: string) {
        const files = fs.readdirSync(directoryPath);

        let concatenatedContent = "";

        files.forEach((file) => {
            const filePath = path.join(directoryPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                // If the current file is a directory, recursively call readFilesInDirectory
                concatenatedContent += FileHelper.readFilesInDirectory(filePath);
            } else {
                // If the current file is a regular file, read its content and concatenate
                const fileContent = fs.readFileSync(filePath, "utf8");
                concatenatedContent += fileContent;
            }
        });

        return concatenatedContent;
    }
}

export { FileHelper };
