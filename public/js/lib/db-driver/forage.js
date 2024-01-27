class SnpForageDbDriver {
    constructor() {
        this.dbs = {}
        this.deletedDocs = {}
        this.ongoingFieldUpdatePromises = {}

        document.addEventListener('snpSocketSaveDoc', async (e) => {
            const doc = e.detail
            this.upsertDoc(doc)
        })

        document.addEventListener('snpSocketSaveDocs', async (e) => {
            const docs = e.detail
            this.upsertDocs(docs)
        })
    }

    getDb(dbName) {
        if (!(dbName in this.dbs)) {
            this.dbs[dbName] = localforage.createInstance({ name: dbName })
        }

        return this.dbs[dbName]
    }

    async getDoc(snpId) {
        return new Promise((resolve) => {
            var dbName = snpId.split('-')[0]
            var db = this.getDb(dbName)
            db.getItem(snpId).then((doc) => {
                resolve(doc)
            })
        })
    }

    async find(passedOptions) {
        const defaults = {
            snptype: "snpnotype",
            fields: {},
            filters: {},
            filterType: "fuzzy",
            filterOperator: "OR",
            offset: 0,
            amount: 10,
            orderer: "",
            order: "ASC",
            ordertype: "text",
            recursive: 1,
            revision: "",
            debug: false,
            justinfo: false,
            live: true
        };

        const options = extend(defaults, passedOptions);
        
        if (hasPermission('own', options.snptype)) {
            options.filters['creator.snpId'] = globalThis.snpUser.snpId
        }

        return new Promise((resolve) => {

            var db = this.getDb(options.snptype);
            var allDocs = {}
            var filteredDocs = {}
            var count = 0

            db.iterate((doc, key) => {
                if (doc.snp_deleted || this.deletedDocs[key]) {
                    if (allDocs[key]) {
                        delete allDocs[key]
                    }

                    this.deletedDocs[key] = doc
                } else {
                    if (!(key in allDocs)) {
                        count++
                        allDocs[key] = doc

                        if (this.passesFilters(doc, options)) {
                            filteredDocs[key] = doc
                        }

                    }
                }
            }).then(async () => {
                // sort results
                filteredDocs = Object.values(filteredDocs)
                filteredDocs = this.sortDocs(filteredDocs, options)

                // get paginated results
                var pagedDocs = filteredDocs.slice(options.offset, options.offset + options.amount)

                // finally update doc rels
                var finalDocs = []
                for (let doc of pagedDocs) {
                    finalDocs.push(await this.updateFields(doc))
                }

                resolve({
                    count: Object.values(filteredDocs).length,
                    docs: finalDocs
                })
            })
        })
    }

    sortDocs(docs, options) {
        if (!options.snptype) return docs

        var moduleInfo = globalThis.scheme.modules[options.snptype]

        if (!moduleInfo) return docs

        var firstFieldKey = Object.keys(moduleInfo.fields)[0]

        var orderer = options.orderer || firstFieldKey

        if (!orderer) return docs

        var direction = options.order == 'DESC' ? -1 : 1

        var order
        docs.sort((a, b) => {
            if (!a[orderer]) {
                order = -1
            } else if (!b[orderer]) {
                order = 1
            } else {
                var aval = `${a[orderer]}`.toLowerCase()
                var bval = `${b[orderer]}`.toLowerCase()
                if (aval > bval) {
                    order = 1
                } else if (aval < bval) {
                    order = -1
                } else {
                    order = 0
                }
            }

            return order * direction
        })
        return docs
    }

    async updateFields(doc) {

        return new Promise((resolve) => {
            const updatePromises = []
            const moduleInfo = globalThis.scheme.modules[doc.snptype]

            for (let fieldKey of Object.keys(doc)) {

                const fieldInfo = moduleInfo.fields[fieldKey]

                if (fieldInfo && fieldInfo.live && fieldInfo.type) {

                    var promise = this.ongoingFieldUpdatePromises[doc.snpId]

                    if (!promise) {
                        promise = new Promise(async (resolve2) => {

                            const fieldElement = document.createElement('snp-input-' + fieldInfo.type)

                            if ('updateRels' in fieldElement) {
                                if ('initField' in fieldElement) fieldElement.initField(doc)
                                fieldElement.fieldInfo = fieldInfo
                                fieldElement.value = doc[fieldKey]
                                doc[fieldKey] = await fieldElement.updateRels()
                            }
                            delete this.ongoingFieldUpdatePromises[doc.snpId]
                            resolve2()
                        })
                        this.ongoingFieldUpdatePromises[doc.snpId] = promise
                        updatePromises.push(promise)
                    }
                }
            }

            Promise.all(updatePromises).then(() => {
                this.upsertDoc(doc, true)
                resolve(doc)
            })
        })
    }

    passesFilters(doc, options) {

        if (!options.filters || !Object.keys(options.filters).length) {
            return true
        }

        var passes = 0

        for (let filterKey of Object.keys(options.filters)) {
            // Convert JavaScript string in dot notation into an object reference
            var val = filterKey.split('.').reduce((o, i) => o && (i in o) ? o[i] : null, doc)

            if (val && options.filters[filterKey] == '-') {
                passes++
            } else if (val && options.filterType == "fuzzy") {
                var rx = new RegExp(`${options.filters[filterKey]}`, "i")

                if (JSON.stringify(val).match && JSON.stringify(val).match(rx)) {
                    passes++
                }
            } else if (val && val == options.filters[filterKey]) {
                passes++
            }
        }

        if (passes) {

            if (options.filterOperator == 'AND') {
                return passes == Object.keys(options.filters).length
            }

            return true
        }
    }

    async getRevisions(doc) {
        return new Promise((resolve) => {
            resolve([])
        })
    }

    async deleteDocs(docs) {
        return new Promise((resolve) => {
            var promises = []
            for (let doc of docs) {
                promises.push(this.deleteDoc(doc))
            }
            Promise.all(promises).then((result) => {
                resolve(result)
            })
        })
    }

    async deleteDoc(doc) {
        return new Promise((resolve) => {
            doc.snp_deleted = new Date().getTime()
            doc.synced = 0
            this.upsertDoc(doc).then(() => {
                resolve(doc)
            })
        })
    }

    async purgeDeleted() {
        return new Promise((mainResolve) => {
            const promises = []

            Object.keys(globalThis.scheme.modules).forEach((moduleKey) => {
                promises.push(new Promise((resolve) => {
                    var db = this.getDb(moduleKey);
                    var removedCount = 0
                    db.iterate((doc) => {
                        if (doc.snpId in this.deletedDocs && doc.synced) {
                            removedCount++
                            db.removeItem(doc.snpId)
                        }
                    }).then(() => {
                        resolve(removedCount);
                    })
                }))

            })

            Promise.all(promises).then((docs) => {
                mainResolve(docs);
            })
        })
    }

    async save(doc) {
        doc.synced = 0;
        doc.date_created = new Date().getTime()
        doc.creator = globalThis.snpUser.snpId
        doc.snp_creator_name = globalThis.snpUser.name

        clearTimeout(this.syncTimeout)
        this.syncTimeout = setTimeout(() => {
            this.sync()
        }, 800)

        return this.upsertDoc(doc)
    }

    async sync(options = {
        forceHistory: false,
        silent: false
    }) {
        // return false
        if (!this.syncPromise) {
            this.syncPromise = new Promise(async (mainResolve) => {

                loader.setAttribute('message', 'Sincronizando...')

                // if (options.forceHistory) {
                //     await this.clearDatabases()
                //     localStorage.setItem('snpSyncTime', 0)
                // }

                this.getUnsynced().then((unsyncedDocs) => {
                    const lastSyncTime = options.forceHistory ? 0 : this.getLastSyncTime()
                    const doResolve = (newDocs) => {
                        
                        if (!options.silent) 
                        	fireEvent(document, 'dbSyncEnd', newDocs)
                        
                        if('length' in newDocs && newDocs.length) 
                        	localStorage.setItem('snpSyncTime', new Date().getTime())
                        
                        loader.setAttribute('message', '')
                        mainResolve(newDocs);
                        this.syncPromise = null
                        
                        if (this.leftToSync) {
                            this.sync(options)
                        } else {
                            this.purgeDeleted()
                        }
                    }

                    callSnpApi("sync", {
                        lastSyncTime: parseInt(lastSyncTime),
                        docs: JSON.stringify(unsyncedDocs),
                        silent: !!options.silent
                    }, async (response) => {
                        this.upsertDocs(response.docs || []).then((upsertedDocs) => {
                            doResolve(upsertedDocs)
                        })
                    }, (jqXHR, textStatus, errorThrown) => {
                        console.error(errorThrown, []);
                        doResolve([])
                    });
                })
            })
        }

        return this.syncPromise
    }

    async upsertDocs(newDocs) {
        return new Promise(async (resolve) => {
            const result = []
            var index = 1
            for (let doc of newDocs) {
                loader.setAttribute('message', `Sincronizando ${index} de ${newDocs.length}...`)
                result.push(await this.upsertDoc(doc))
                index++
            }

            loader.setAttribute('message', ``)

            resolve(result)
        })
    }

    async upsertDoc(newDoc, silent = false) {
        return new Promise((resolve) => {
            if(!newDoc) resolve(false)

            if (!newDoc.snptype) {
                newDoc.snptype = 'snpnotype'
            }

            newDoc.id = this.getRandomId(newDoc.snptype)

            if (!newDoc.snpId) {
                newDoc.snpId = newDoc.id
            }

            const db = this.getDb(newDoc.snptype)

            db.setItem(newDoc.snpId, newDoc).then(function (value) {
                if (!silent) fireEvent(document, 'localSaveDoc', value)
                resolve(value)
            }).catch(function (err) {
                console.error(err);
                resolve(false)
            });
        })
    }

    getRandomId(docType) {
        return `${docType}-${new Date().getTime()}-${globalThis.snpUser.nickname}-${Math.random().toString(36).slice(2, 6)}`
    }

    getUnsynced() {
        this.leftToSync = false

        return new Promise((mainResolve) => {
            const promises = []
            const limit = 10
            let count = 0

            Object.keys(globalThis.scheme.modules).forEach((moduleKey) => {
                promises.push(new Promise((resolve) => {
                    var db = this.getDb(moduleKey);
                    var result = []
                    db.iterate((doc, key) => {
                        if (!doc.synced) {
                            result.push(doc)
                            count++
                        }

                        if (count >= limit) {
                            resolve(result);

                            this.leftToSync = true
                            return 'nonundefined';
                        }
                    }).then(function () {
                        resolve(result);
                    })
                }))
            })

            Promise.all(promises).then((docGroups) => {
                mainResolve(docGroups);
            })
        })
    }

    getLastSyncTime() {
        var syncTime = localStorage.getItem('snpSyncTime')
        if (syncTime) {
            return parseInt(syncTime) - 60
        } else {
            return 0
        }

    }
}