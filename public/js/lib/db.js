class SnpDb {
    constructor() {
        this.dbDriver = new SnpForageDbDriver();
    }

    async getDoc(snpId) {
        return this.dbDriver.getDoc(snpId)
    }

    async find(options) {
        return this.dbDriver.find(options)
    }

    async getRevisions(doc) {
        return this.dbDriver.getRevisions(doc)
    }

    async deleteDocs(docs) {
        return new Promise(async (resolve) => {

            var promises = []

            for (let doc of docs) {
                promises.push(new Promise(async (resolve) => {
                    var beforeDeleteFunc = `${appName}_${doc.snptype}_beforedelete`

                    if (typeof window[beforeDeleteFunc] == 'function') {
                        doc = await window[beforeDeleteFunc](doc)
                    }

                    resolve(doc)
                }))
            }

            docs = await Promise.all(promises)

            var result = await this.dbDriver.deleteDocs(docs)

            promises = []

            for (let doc of docs) {
                promises.push(new Promise(async (resolve) => {
                    var afterDeleteFunc = `${appName}_${doc.snptype}_afterdelete`

                    if (typeof window[afterDeleteFunc] == 'function') {
                        await window[afterDeleteFunc](result)
                        resolve(doc)
                    }
                }))
            }

            await Promise.all(promises)

            resolve(result)
        })
    }

    async save(doc) {
        return new Promise(async (resolve) => {
            var beforeSaveFunc = `${appName}_${doc.snptype}_beforesave`

            if (typeof window[beforeSaveFunc] == 'function') {
                doc = await window[beforeSaveFunc](doc)
            }

            const result = await this.dbDriver.save(doc)

            var afterSaveFunc = `${appName}_${doc.snptype}_aftersave`

            if (typeof window[afterSaveFunc] == 'function') {
                await window[afterSaveFunc](result)
            }

            resolve(result)
        })
    }

    async sync(options) {
        return await this.dbDriver.sync(options)
    }
}

const snpdb = new SnpDb()