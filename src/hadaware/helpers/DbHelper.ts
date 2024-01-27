import { HadaDb } from "../lib/HadaDb";
import { AppHelper } from "./AppHelper";

class DbHelper {
    public static async insertDocs(docgroups: any[]) {
        let resultDocs: any[] = [];

        for (const docs of docgroups) {

            if (!docs.length) { continue; }

            const plainDocList = [];

            for (const doc of docs) {
                if (!doc.id) { continue; }
                doc.synced = Date.now();
                plainDocList.push(doc);
            }

            const dbDriver = HadaDb.getDbDriver(AppHelper.getAppName());
            const insertedDocs: any[] | undefined = await dbDriver.insertDocs(plainDocList);

            if (insertedDocs?.length) {
                const actualDocs = insertedDocs.map((doc) => {
                    return doc.document_data;
                });
                resultDocs = resultDocs.concat(actualDocs);
            }
        }

        return resultDocs;
    }
}

export { DbHelper };
