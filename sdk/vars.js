const config = {
    "port":process.env.attendance_port || 9009,
    "keycloak": {
        "url": process.env.keycloak_url || "http://localhost:8081", 
        "realmName": process.env.keycloak_realmName || "TeacherRegistry",
        "clientId": "utils",
        "clientSecret": process.env.keycloak_clientSecret || "3dd60e8a-bee4-4ceb-ad22-e10f8182ec59"
    },
    "utilServiceUrl":"http://localhost:9081"
}

module.exports = config
