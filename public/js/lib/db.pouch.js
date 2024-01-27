class SnpDb {
    constructor() {
        if (!PouchDB) console.error('No PouchDB!')
        this.dbInstances = {}
    }

    getDoc(snpId, callback) {
        if (!snpId) return {}
        var moduleKey = snpId.split("-")[0];
        this.getDbInstance(moduleKey, (db) => {
            db.find({
                selector: { snpId: snpId, status: 'active', snp_deleted: { '$ne': 1 } },
            }).then((result) => {
                if (result.docs.length) {
                    callback(result.docs[0])
                } else {
                    callback([])
                }
            }).catch((err) => {
                console.error(err)
            });
        })
    }

    findOne(id, callback) {
        if (!id) return {}
        var moduleKey = id.split("-")[0];
        this.getDbInstance(moduleKey, (db) => {
            db.find({
                selector: { id: id, snp_deleted: { '$ne': 1 } },
            }).then((result) => {
                callback(result)
            }).catch((err) => {
                console.error(err)
            });
        })
    }

    findAll(dbName, callback) {
        this.getDbInstance(dbName, (db) => {
            db.find({
                selector: { snptype: dbName, snp_deleted: { '$ne': 1 } },
            }).then((result) => {
                callback(result)
            }).catch((err) => {
                console.error(err)
            });
        })
    }

    deleteDocs(dbName, docs, callback) {
        docs.forEach((doc, index) => {
            docs[index].snp_deleted = 1
        })

        this.getDbInstance(dbName, (db) => {
            db.bulkDocs(docs, {}, (result) => {
                if (callback) callback(result)
            })
        })
    }

    find(passedOptions, callback) {

        const defaults = {
            snptype: "",
            fields: {},
            filters: {},
            filterType: "fuzzy",
            filterOperator: "OR",
            offset: 0,
            amount: 10,
            orderer: "",
            order: "DESC",
            ordertype: "text",
            recursive: 1,
            revision: "",
            debug: false,
            justinfo: false,
        };

        const options = extend(defaults, passedOptions);

        const filters = {}

        Object.keys(options.filters).forEach((filterKey) => {
            filters[filterKey] = { '$regex': new RegExp(`${options.filters[filterKey]}`, "i") }
        })

        filters.snptype = { '$eq': options.snptype }
        let totalDocs = 0

        filters.status = { '$eq': "active" }
        filters.snp_deleted = { '$ne': 1 }

        this.getDbInstance(options.snptype, (db) => {
            db.find({
                selector: filters
            }).then((result) => {
                totalDocs = result.docs.length
                const docs = this.sortDocs(result.docs, options)
                const slicedDocs = docs.slice(options.offset, options.offset + options.amount)
                callback({ count: totalDocs, docs: slicedDocs })
            }).catch((err) => {
                console.error(err)
            });
        })

        /*
        db.find(filters)
        .sort({ snpId: -1 })
        .skip(options.offset)
        .limit(options.amount)
        .exec(function (err, docs) {
            console.log('getDocs', docs)
            if (err) {
                console.error(err)
            } else if (callback) callback({ count: totalDocs, docs: docs });
        }); */
    }

    sortDocs(docs, options) {
        docs.sort(function (a, b) {
            if (a.snpId < b.snpId) {
                return 1;
            }
            if (a.snpId > b.snpId) {
                return -1;
            }

            return 0;
        });
        return docs
    }

    save(data, callback) {
        if (!data.snptype) return console.error('No snptype on save.')

        this.getDbInstance(data.snptype, (localDb) => {
            const doUpsert = () => {
                localDb.upsert(data.id, function () {
                    data.status = 'active'
                    data.date_created = new Date().getTime()
                    data.creator = globalThis.snpUser
                    return data;
                }).then(function (res) {
                    fireEvent(document, 'snpLocalDbChange', { dbName: data.snptype })
                    callback(data)
                }).catch(function (err) {
                    console.error('Error Saving', err)
                });
            }

            if (data.snpId) {
                localDb.upsert(data.id, (doc) => {
                    doc.status = 'revision'
                    return doc;
                })
                    .then(() => {
                        data.id = this.getRandomId(data.snptype)
                        doUpsert()
                    }).catch((err) => {
                        console.error('Error archiving', err)
                    });
            } else {
                data.id = this.getRandomId(data.snptype)
                data.snpId = data.id

                doUpsert()
            }
        })
    }

    getRandomId(dbName) {
        return `${dbName}-${Math.random().toString(36).slice(2, 12)}`
    }

    getDbInstance(dbName, callback) {
        if (dbName in this.dbInstances) {
            callback(this.dbInstances[dbName])
        } else {
            this.initDb(dbName, callback)
        }
    }

    getRevisions(doc, callback) {

        if (!doc || !doc.snpId) return { docs: [] }

        var moduleKey = doc.snpId.split("-")[0];

        this.getDbInstance(moduleKey, (db) => {
            db.find({
                selector: { snpId: doc.snpId, status: 'revision', snp_deleted: { '$ne': 1 } },
            }).then((result) => {
                const docs = result.docs

                this.getDoc(doc.snpId, (currentDoc) => {
                    if (currentDoc) docs.push(currentDoc)
                    if (callback) callback({ docs: result.docs });
                })
            }).catch((err) => {
                console.error(err)
            });
        })
    }


    initDb(dbName, callback) {

        //Create a local db
        const localDb = new PouchDB(appName + '_' + dbName, { auto_compaction: true });
        this.dbInstances[dbName] = localDb

        const remoteDb = new PouchDB('https://laestrellita.sinaptics.com:6984/' + appName + '_' + dbName, {
            fetch: function (url, opts) {
                opts.headers.set('Accept', 'application/json');
                opts.headers.set('Content-Type', 'application/json');
                opts.headers.set('Authorization', `Basic ${btoa('admin:fdsa4321')}`);
                return PouchDB.fetch(url, opts);
            },
            auto_compaction: true
        });

        fireEvent(document, 'snpDbSyncStart', dbName);

        localDb.replicate.to(remoteDb).on('complete', function () {
            remoteDb.replicate.to(localDb).on('complete', function () {

                fireEvent(document, 'snpDbSyncEnd', dbName);

                localDb.sync(remoteDb, { live: true, retry: true, /* other sync options */ })
                    .on('change', function (info) {
                        console.log("change.", info);
                        info.dbName = dbName
                        fireEvent(document, 'snpDbChange', info)
                    }).on('paused', function (err) {
                        console.info('db rep paused', err)
                        fireEvent(document, 'snpDbPaused', err)
                    }).on('active', function () {
                        console.info('db rep active')
                    }).on('denied', function (err) {
                        console.info('db rep denied', err)
                    }).on('complete', function (info) {
                        console.info('db rep complete', info)
                    }).on('error', function (err) {
                        console.info('db rep error', err)
                    });

                callback(localDb)
            }).on('error', function (err) {
                console.log('Error replicating to local DB')
                callback(localDb)
            });
        }).on('error', function (err) {
            console.log('Error replicating to remoteDb')
            callback(localDb)
        });
    }
}

const snpdb = new SnpDb()