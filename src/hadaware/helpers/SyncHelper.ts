import { Request } from "express";
import { HadaDb } from "../lib/HadaDb";
import { AppHelper } from "./AppHelper";
import { DbHelper } from "./DbHelper";

class SyncHelper {
    public static async fromClient(req: Request) {
        let insertResults: any = {};
        const docsGroupedByType = JSON.parse(req.body.docs);

        if (docsGroupedByType.length) {
            insertResults = await DbHelper.insertDocs(docsGroupedByType);
        }

        const scheme = AppHelper.getScheme(AppHelper.getAppName(req));

        const dbNames = [];

        for (const moduleKey in scheme.modules) {
            if (scheme.modules.hasOwnProperty(moduleKey)) {
                dbNames.push(moduleKey);
            }
        }

        const newDocs = await HadaDb.getUnsynced(dbNames, req.body.lastSyncTime);

        return {docs: insertResults.concat(newDocs)};

        // console.log('newDocs', newDocs)

        // return insertResult.docs.concat(newDocs)

        // $scheme = getScheme();
        // $docs = array();
        // foreach($scheme->modules as $moduleKey => $moduleInfo){
        //     $db = $client->{$appName};
        //     $collection = $db->{$moduleKey};

        //     $cursor = $collection->aggregate([
        //         ['$sort' => ['id' => -1]],
        //         ['$match' => ['synced' => ['$gt' => (int) $_POST['lastSyncTime']]]],
        //         ['$group' => [
        //             'id' => '$snpId',
        //             'doc' => ['$first' => '$$CURRENT']
        //             ]
        //         ]
        //     ]);

        //     foreach ($cursor as $document) {
        //         $docs[] = $document->doc;
        //     }

        // }
        // $insertResult['docs'] = array_merge($insertResult['docs'], $docs);
        // echo json_encode($insertResult);
    }
}

export {SyncHelper};
