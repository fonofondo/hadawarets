class UserHelper {
    public static getRootUserData() {
        return {
            id: "root",
            name: "Servicio Técnico",
            nickname: "root",
            cargo: {
                id: "roles-1610950541330-root-rfa1",
                name: "Administrador",
                notes: "",
                permissions: [
                    "view-all",
                    "edit-all",
                    "delete-all",
                    "endorse-all"
                ],
                snptype: "roles",
                snpId: "roles-root",
                synced: "1609830585685",
                status: "active",
                date_created: "1609830584732",
                creator: {}
            },
            email: "froilanm@hadatec.com",
            phone: "",
            address: "",
            notes: "",
            snptype: "users",
            snpId: "root"
        };
    }

}

export { UserHelper };
