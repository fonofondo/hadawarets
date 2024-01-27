function SnpRxDbDriver() {
    var t = this;

    /**
     *
     */
    t.getDb = function (moduleKey) {
        return new Nedb({ filename: moduleKey, autoload: true });
    };

    /**
     *
     */
    t.getDocs = function (passedOptions, callback) {
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

        var db = t.getDb(options.snptype);

        db.find({ status: "active", snptype: options.snptype })
            .sort({ snpId: -1 })
            .skip(0)
            .limit(options.amount)
            .exec(function (err, docs) {
                if (err) {
                    console.error(err)
                } else if (callback) callback(docs);
            });
    };

    /**
     *
     */
    t.saveDoc = function (passedOptions) {
        const defaults = {
            moduleKey: "",
            doc: {},
            emit: false,
            sync: false,
            callback: function () { },
        };

        const options = extend(defaults, passedOptions);

        if (!options.moduleKey && options.doc.snptype) {
            options.moduleKey = options.doc.snptype;
        }
        console.log('options', options)
        if (!options.moduleKey) {
            if ("callback" in options) options.callback(false);
            return; // give up
        }

        var doc = options.doc;

        var doUpsert = function (newDoc) {
            if (options.sync) newDoc.synced = 0;
            t.upsertDoc(newDoc, function (err) {
                if (err) return console.error(err);
                if ("callback" in options) options.callback(newDoc);
                if (options.sync) t.syncDoc(newDoc);
            });
        };

        if (doc.id) {
            doUpsert(doc);
        } else {
            doc.id = t.getRandomId(doc.snptype)

            if (doc.snpId) {
                t.getDoc(doc.snpId, function (err, oldDoc) {
                    t.archiveDoc(oldDoc, options.sync, function () {
                        doUpsert(doc);
                    });
                });
            } else {
                doc.snpId = doc.id;
                doUpsert(doc);
            }
        }
    };

    t.getRandomId = function (docType) {
        return `${docType}-${Math.random().toString(36).slice(2, 12)}`
    }

    t.upsertDoc = function (doc, callback) {
        var moduleDb = t.getDb(doc.snptype);
        moduleDb.update({ id: doc.id }, doc, { upsert: true }, function (err) {
            if (callback) callback(err);
        });
    };

    t.upsertDocs = function (docs, callback) {
        t.insertNext(docs, function () {
            if (callback) callback();
        });
    };

    t.insertNext = function (docs, callback) {
        const newDoc = docs.shift();
        if (!newDoc) {
            if (callback) callback();
            return;
        }
        t.upsertDoc(newDoc, (err) => {
            if (err) return console.error(err);
            t.insertNext(docs, callback);
        });
    };

    /**
     *
     */
    t.archiveDoc = function (oldDoc, sync, callback) {
        oldDoc.status = "revision";
        oldDoc.synced = 0;
        t.upsertDoc(oldDoc, function (err) {
            if (callback) callback(err);
            if (sync) t.syncDoc(oldDoc);
        });
    };

    /**
     *
     */
    t.getDoc = function (snpId, callback) {
        var moduleKey = snpId.split("|")[0];

        var db = t.getDb(moduleKey);

        db.findOne({ status: "active", snptype: moduleKey, snpId: snpId }, function (
            err,
            doc
        ) {
            if (callback) callback(err, doc);
        });
    };

    t.destroyCollection = function (moduleKey, callback) {
        var db = t.getDb(moduleKey);
        db.remove({}, { multi: true }, function (err, numRemoved) {
            if (callback) callback();
        });
    };

    /**
     *
     */
    t.syncDoc = function (doc, callback) {
        doc.synced = 1;
        snp.callApi("saveDoc", doc, function (newDoc) {
            if (newDoc) {
                t.upsertDoc(newDoc, function (err) {
                    if (callback) callback(err);
                    snp.socket.emit("saveDoc", newDoc);
                });
            }
        });
    };

    t.syncDocs = function (docs, callback) {
        t.syncNext(docs, function () {
            if (callback) callback();
        });
    };

    t.syncNext = function (docs, callback) {
        const newDoc = docs.shift();
        if (!newDoc) {
            if (callback) callback();
            return;
        }
        t.syncDoc(newDoc, (err) => {
            t.syncNext(docs, callback);
        });
    };
}