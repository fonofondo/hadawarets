import BetterDatabase from "better-sqlite3";
import path from "path";
import { Database } from "sqlite3";
import { AppHelper } from "../helpers/AppHelper";
import { randomString } from "../helpers/randomString";

interface IDocument {
    id: string;
    snpId: string;
    date_created: number;
    synced: number;
    is_deleted: boolean;
    document_data: Record<string, any>;
}

interface IRowType {
    id: string;
    snpId: string;
    date_created: number;
    synced: number;
    is_deleted: boolean;
    document_data: string; // it's stored as a string in the database
}

class HadaDb {

    public static instances: Record<string, HadaDb> = {};

    public static getDbDriver(appName: string) {
        if (HadaDb.instances[appName]) {
            return HadaDb.instances[appName];
        }

        const dbDriver = new HadaDb(appName);

        HadaDb.instances[appName] = dbDriver;
        return dbDriver;
    }

    public static async backupDatabase(sourcePath: string, destinationPath: string): Promise<void> {
        const sourceDb = new BetterDatabase(sourcePath);
        try {
            // Use better-sqlite3 for backup
            sourceDb.backup(destinationPath);
        } finally {
            sourceDb.close();
        }
    }

    public static async getUnsynced(dbNames: string[], fromDate: number): Promise<IDocument[]> {
        let flatDocList: IDocument[] = [];
        const dbdriver = HadaDb.getDbDriver(AppHelper.getAppName());

        for (const dbName of dbNames) {
            const db = dbdriver.getDatabase(dbName);
            await dbdriver.ensureTable(db); // Ensure the table exists before querying

            const documents = await dbdriver.getUnsyncedDocs(db, fromDate);

            if (documents.length) { flatDocList = flatDocList.concat(documents); }

            db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        }

        return flatDocList;
    }

    public static groupDocsByType(docs: any[]) {
        const groupedDocs: Record<string, any[]> = {};

        for (const doc of docs) {
            if (!groupedDocs[doc.snptype]) {
                groupedDocs[doc.snptype] = [];
            }
            groupedDocs[doc.snptype].push(doc);
        }

        const result = [];
        for (const docGroup of Object.values(groupedDocs)) {
            result.push(docGroup);
        }

        return result;
    }

    ////////

    public appName: string;
    public moduleDbs: Record<string, Database> = {};
    public ensuredTables: Record<string, boolean> = {};

    constructor(appName: string) {
        this.appName = appName;
    }

    public async getUnsyncedDocs(db: Database, fromDate: number): Promise<IDocument[]> {
        return new Promise((resolve, reject) => {
            const query = `
            SELECT m.id, m.snpId, m.date_created, m.synced, m.is_deleted, m.document_data
            FROM ModuleData m
            JOIN (
                SELECT id, MAX(synced) AS latestSynced
                FROM ModuleData
                WHERE synced > ?
                GROUP BY snpId
            ) latest ON m.id = latest.id AND m.synced = latest.latestSynced
            `;

            db.all(query, [fromDate], (err, rows: IRowType[]) => {
                if (err) {
                    reject(err);
                } else {
                    const documents: any[] = rows.map((row) => (JSON.parse(row.document_data)));
                    resolve(documents);
                }
            });
        });
    }

    public async insertDocs(docs: any[]): Promise<any[]> {
        const moduleDb = this.getDatabase(docs[0].snptype);
        await this.ensureTable(moduleDb);

        return new Promise((resolve, reject) => {
            const documents: IDocument[] = docs.map((doc) => this.createDocument(doc));

            moduleDb.serialize(() => {
                const valuesPlaceholder = Array(documents.length).fill("(?, ?, ?, ?, ?, JSON(?))").join(", ");
                const query = `INSERT OR REPLACE INTO ModuleData
                                (id, snpId, date_created, synced, is_deleted, document_data)
                                VALUES ${valuesPlaceholder}`;

                const flattenedValues = documents
                    .map(({ id, snpId, date_created, synced, is_deleted, document_data }) =>
                        [id, snpId, date_created, synced, is_deleted, JSON.stringify(document_data)])
                    .reduce((acc, val) => acc.concat(val), []);

                moduleDb.run(query, flattenedValues, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(documents.map((doc) => doc.document_data));
                    }
                });
            });

            moduleDb.close((err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        });
    }

    // insertOrReplaceDocuments(db: Database, docs: any[]): Promise<IDocument[]> {
    //     return new Promise((resolve, reject) => {
    //         // Convert the input objects to IDocument format
    //         const documents: IDocument[] = docs.map((doc) => this.createDocument(doc));

    //         // Insert or replace all documents into the table at once
    //         db.serialize(() => {
    //         const valuesPlaceholder = Array(documents.length).fill('(?, ?, ?, JSON(?))').join(', ');
    //         const query = `INSERT OR REPLACE INTO ModuleData (id, snpId, date_created,
    //                              synced, is_deleted, document_data) VALUES ${valuesPlaceholder}`;

    //         const flattenedValues = documents
    //             .map(({ id, snpId, date_created, synced, is_deleted, document_data }) =>
    //                     [id, snpId, date_created, synced, is_deleted, JSON.stringify(document_data)])
    //             .reduce((acc, val) => acc.concat(val), []);

    //         db.run(query, flattenedValues, (err) => {
    //             if (err) {
    //             reject(err);
    //             } else {
    //             // Return the date_created documents as if they were fetched from the database
    //             resolve(documents);
    //             }
    //         });
    //         });
    //     });
    // }

    public createDocument(doc: any): IDocument {
        const dateCreated = Date.now();
        const id = doc.id ? doc.id : `${doc.snptype}-${dateCreated}-${randomString(5)}`;
        const revisionId = randomString(5);

        const modifiedDocument: IDocument = {
            id,
            snpId: doc.snpId,
            date_created: doc.dateCreated,
            synced: doc.synced,
            is_deleted: false,
            document_data: doc,
        };

        return modifiedDocument;
    }

    public async ensureTable(db: Database) {
        return new Promise((resolve, reject) => {
            // Check if the table already exists
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ModuleData'", (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    // The table does not exist, so create it
                    db.serialize(() => {
                        db.run(`
                        CREATE TABLE ModuleData (
                            id TEXT,
                            snpId TEXT,
                            date_created INTEGER,
                            synced INTEGER,
                            is_deleted BOOLEAN,
                            document_data JSON,
                            PRIMARY KEY (id)
                          );
                `, (error) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve('Table "ModuleData" date_created.');
                            }
                        });
                    });
                } else {
                    resolve('Table "ModuleData" already exists.');
                }
            });
        });
    }

    public getDatabase(dbName: string) {
        // if (this.moduleDbs[dbName]) {
        //     return this.moduleDbs[dbName];
        // }
        const dbPath = path.join(__dirname, "..", "..", "..", "assets", this.appName, "db", `${dbName}.db`);
        const moduleDb = new Database(dbPath);
        this.moduleDbs[dbName] = moduleDb;
        return moduleDb;
    }
}

export { HadaDb };
