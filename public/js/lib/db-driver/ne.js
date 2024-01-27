class SnpNeDbDriver {
    constructor() {
        this.dbs = []
        this.syncPromises = {}
        this.syncResults = {}
        this.syncTimes = {}

        document.addEventListener('snpSocketSaveDoc', async (e) => {
            const doc = e.detail
            this.socketSync([doc])
        })

        document.addEventListener('snpSocketSaveDocs', async (e) => {
            const docs = e.detail
            this.socketSync(docs)
        })
    }

    /**
     *
     */
    getDb(moduleKey) {
        return new Nedb({ filename: moduleKey, autoload: true });
    };

    /**
     *
     */
    async socketSync(docs) {
        if (!docs.length) return;
        await this.upsertDocs(docs)
        fireEvent(document, 'dbSyncEnd', docs)
    };


    async getUnsynced() {
        return new Promise((mainResolve) => {
            const promises = []

            Object.keys(globalThis.scheme.modules).forEach((moduleKey) => {
                promises.push(new Promise((resolve) => {
                    var db = this.getDb(moduleKey);
                    db.find({ synced: 0 }, (err, docs) => {
                        if (docs.length) {
                            resolve(docs);
                        } else {
                            resolve([]);
                        }
                    });
                }))

            })

            Promise.all(promises).then((docs) => {
                mainResolve(docs);
            })
        })
    }

    /**
     *
     */
    async sync(options = {}) {

        if (!this.syncPromise) {
            this.syncPromise = new Promise(async (mainResolve) => {

                loader.setAttribute('message', 'Sincronizando...')

                // if (options.forceHistory) {
                //     await this.clearDatabases()
                //     localStorage.setItem('snpSyncTime', 0)
                // }

                this.getUnsynced().then((unsyncedDocs) => {
                    this.getLastSyncTime().then((lastSyncTime) => {

                        const doResolve = (newDocs) => {
                            // fireEvent(document, 'dbSyncEnd', newDocs)
                            loader.setAttribute('message', '')
                            localStorage.setItem('snpSyncTime', new Date().getTime())
                            mainResolve(newDocs);
                            this.syncPromise = null
                        }

                        callSnpApi("sync", {
                            lastSyncTime: parseInt(lastSyncTime),
                            docs: unsyncedDocs
                        }, async (newDocs) => {
                            console.log('received docs', newDocs)
                            this.upsertDocs(newDocs).then(() => {
                                console.log('dbSyncEnd', newDocs);
                                doResolve(newDocs)
                            })
                        }, (jqXHR, textStatus, errorThrown) => {
                            console.error(errorThrown, []);
                            doResolve([])
                        });
                    })
                })
            })
        }

        return this.syncPromise
    };


    async clearDatabases() {
        return new Promise((mainResolve) => {
            var promises = []
            Object.keys(globalThis.scheme.modules).forEach((moduleKey) => {
                promises.push(new Promise((resolve) => {
                    this.clearDatabase(moduleKey).then(() => resolve())
                }))
            })
            Promise.all(promises).then((result) => {
                mainResolve(result)
            })
        })
    }


    async clearDatabase(dbName) {
        return new Promise((resolve) => {
            console.log('clearing', dbName)
            const db = this.getDb(dbName)
            db.remove({}, { multi: true }, (err, numRemoved) => {
                db.loadDatabase((err) => {
                    resolve(this.getDb(dbName))
                });
            });
        })

    }


    /**
     *
     */
    async getLastSyncTime(moduleKey) {
        return new Promise((resolve) => {
            resolve(localStorage.getItem('snpSyncTime') || 0)
        })
    }


    /**
     *
     */
    async find(passedOptions) {
        return new Promise(async (resolve) => {
            const defaults = {
                snptype: "",
                fields: {},
                filters: {},
                filterType: "fuzzy",
                filterOperator: "OR",
                offset: 0,
                amount: 10,
                orderer: "snpId",
                order: "DESC",
                ordertype: "text",
                recursive: 1,
                revision: "",
                debug: false,
                justinfo: false,
                live: true
            };

            const options = extend(defaults, passedOptions);
            const db = this.getDb(options.snptype);
            const filters = {}

            // build filters
            Object.keys(options.filters).forEach((filterKey) => {
                if (options.filterType == "fuzzy") {
                    filters[filterKey] = new RegExp(`${options.filters[filterKey]}`, "i")
                } else {
                    filters[filterKey] = options.filters[filterKey]
                }
            })

            // filters.status = "active" // exclude revisions
            filters.snp_deleted = { $exists: false } // exclude deleted docs

            if (hasPermission('own', options.snptype)) {
                // filters['creator.snpId'] = globalThis.snpUser.snpId
            }

            // this.sync() // await

            // get total doc count
            let totalDocs = await this.getTotalDocs(options.snptype, filters)

            const sort = {}
            sort[options.orderer.replace('.', '_')] = options.order == 'DESC' ? -1 : 1

            const key = {
                'snpId': 1,
            }

            key[options.orderer] = 1
            console.log('filters', filters)
            // query local db
            db.find(filters)
                .group({
                    key: key,
                    reduce: (curr, result) => {
                        //if (!result.doc.date_created || curr.date_created > result.doc.date_created) {
                        result.doc = curr
                        //}

                        result.count++;
                    },
                    initial: {
                        count: 0,
                        doc: {}
                    }
                })
                .sort(sort)
                .skip(options.offset)
                .limit(options.amount)
                .exec(async (err, cursor) => {
                    console.log('cursor', cursor)
                    if (err || !cursor.length) {
                        if (err) console.error(err)
                        resolve({ count: 0, docs: [] });
                        return;
                    }

                    const docs = []

                    for (let current of cursor) {
                        docs.push(current.doc)
                    }

                    if (options.live) {
                        //docs = await this.updateFields(docs)
                        // this.sync()
                    }

                    resolve({ count: totalDocs, docs: docs });
                });
        })
    };



    /**
     *
     */
    async getTotalDocs(dbName, filters) {
        return new Promise((resolve) => {
            const db = this.getDb(dbName);

            db.count(filters, function (err, count) {
                resolve(count)
            });
        })
    }


    /**
     *
     */
    async updateFields(docs) {
        return new Promise(async (resolve1) => {
            const updatePromises = []
            for (let doc of docs) {
                const moduleInfo = globalThis.scheme.modules[doc.snptype]
                for (let fieldKey of Object.keys(doc)) {
                    updatePromises.push(() => {
                        return new Promise(async (resolve2) => {
                            const fieldInfo = moduleInfo.fields[fieldKey]

                            if (!fieldInfo || !fieldInfo.type) {
                                resolve2()
                                return
                            }

                            const fieldElement = document.createElement('snp-input-' + fieldInfo.type)

                            if ('updateRels' in fieldElement) {
                                if ('initField' in fieldElement) fieldElement.initField(doc)
                                fieldElement.fieldInfo = fieldInfo
                                fieldElement.value = doc[fieldKey]
                                doc[fieldKey] = await fieldElement.updateRels()
                            }

                            resolve2()
                        })
                    })
                }
            }

            // await Promise.all(updatePromises)

            const reponse = []
            for (let updatePromise of updatePromises) {
                reponse.push(await updatePromise())
            }

            await this.upsertDocs(docs)

            resolve1(docs);
        })
    }

    /**
     *
     */
    async deleteDocs(docs) {

        return new Promise(async (resolve) => {
            if (!docs.length) {
                resolve()
                return
            }

            const deletePromises = []

            docs.forEach((doc) => {
                deletePromises.push(async () => {
                    return new Promise(async (resolve) => {
                        const moduleDb = this.getDb(doc.snptype);
                        moduleDb.update(
                            { snpId: doc.snpId },
                            { $set: { snp_deleted: new Date().getTime(), synced: 0 } },
                            { upsert: true, multi: true, returnUpdatedDocs: true },
                            (err, numAffected, affectedDocuments) => {
                                if (err) {
                                    console.error('update error', err)
                                } else {
                                    // this.sync() // no waiting here
                                }

                                resolve(affectedDocuments);
                            });
                    })
                })
            })

            //const response = await Promise.all(deletePromises)
            const response = []

            for (let deletePromise of deletePromises) {
                const result = await deletePromise()
                response.push(result)
            }

            resolve(response)
        })
    }


    /**
     *
     */
    formatDocs(rows) { };


    /**
     *
     */
    async saveDoc(doc) {
        // await this.archiveDoc(doc)

        doc.id = this.getRandomId(doc.snptype)
        if (!doc.snpId) doc.snpId = doc.id;

        doc.synced = 0;
        doc.status = 'active'
        doc.date_created = new Date().getTime()
        doc.creator = globalThis.snpUser
        doc.snp_creator_name = globalThis.snpUser.name

        await this.upsertDoc(doc);
        // this.sync()
        fireEvent(document, 'localSaveDoc', doc)
        return doc
    };


    /**
     *
     */
    archiveDoc(doc) {
        return new Promise((resolve) => {
            if (!doc.snpId) resolve();
            var moduleDb = this.getDb(doc.snptype);
            moduleDb.update({ snpId: doc.snpId, status: "active" },
                { $set: { status: "revision", synced: 0 } },
                { multi: true },
                (err, numReplaced) => {
                    if (err) {
                        console.error(err)
                    }
                    resolve(err);
                });
        })
    };


    /**
     *
     */
    async upsertDoc(doc) {
        return new Promise((resolve) => {
            var moduleDb = this.getDb(doc.snptype);
            moduleDb.update({ id: doc.id }, doc, { upsert: true }, (err) => {
                if (err) console.error('update error', err)
                console.log('upsertDoc', doc)
                resolve(doc);
                // moduleDb.persistence.compactDatafile()
            });
        })
    };

    /**
     *
     */
    async upsertDocs(docs) {
        return new Promise(async (resolve) => {
            const response = []
            for (let doc of docs) {
                response.push(await this.upsertDoc(doc))
            }

            // const response = []
            // for (let prom in promises) {
            //     const result = await prom
            //     console.log('upsertDocs', result)
            //     response.push(result)
            // }


            resolve(response)
        })
    };


    /**
     *
     */
    getDocById(id, callback) {
        var moduleKey = id.split("-")[0];

        var db = this.getDb(moduleKey);

        db.findOne({ id: id }, function (
            err,
            doc
        ) {
            if (callback) callback(err, doc);
        });
    };


    /**
     *
     */
    getDoc(snpId) {
        return new Promise((resolve) => {
            var moduleKey = snpId.split("-")[0];

            var db = this.getDb(moduleKey);

            db.findOne({ status: "active", snpId: snpId, snp_deleted: { $exists: false } }, function (
                err,
                doc
            ) {
                if (err) console.error(err)
                resolve(doc);
            });
        })
    };

    /**
     *
     */
    getRandomId(docType) {
        return `${docType}-${new Date().getTime()}-root-${Math.random().toString(36).slice(2, 6)}`
    }

    /**
     *
     */
    async getRevisions(doc) {
        return new Promise((resolve) => {
            if (!doc || !doc.snpId) resolve({ docs: [] })

            var moduleKey = doc.snpId.split("-")[0];

            var db = this.getDb(moduleKey);
            db.find({ snpId: doc.snpId, status: 'revision' })
                .exec((err, docs) => {
                    if (err) {
                        console.error(err)
                        resolve({ docs: [] })
                    } else {
                        this.getDoc(doc.snpId)
                            .then((currentDoc) => {
                                if (currentDoc) docs.push(currentDoc)
                                resolve({ docs: docs })
                            })
                    }
                });
        })
    }

    /**
     *
     */
    destroyCollection(moduleKey, callback) {
        var db = this.getDb(moduleKey);
        db.remove({}, { multi: true }, function (err, numRemoved) {
            if (callback) callback();
        });
    };
}