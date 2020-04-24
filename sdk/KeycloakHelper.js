var keyCloakAuthUtils = require('keycloak-auth-utils');

class KeycloakHelper {

    /**
     * @param {object} config : keycloak config should contain four params url, realmName, clientId, clientSecret
     */
    constructor(config) {
        this.realmName = config.realmName;
        this.keyCloakHost = config.url;
        this.keyCloak_config = {
            realm: config.realmName,
            "auth-server-url": config.url + "/auth",
            credentials: {
                secret: config.clientSecret
            },
            bearerOnly: true,
            clientId: config.clientId
        }
    }

    async getToken(callback) {
        this.keyCloakConfig = new keyCloakAuthUtils.Config(this.keyCloak_config);
        this.grantManager = new keyCloakAuthUtils.GrantManager(this.keyCloakConfig);
        try {
            let grant = await this.grantManager.obtainFromClientCredentials(undefined, 'openid');
            return callback(null, grant);
        } catch (error) {
            callback(error)
        }
    }    
}

module.exports = KeycloakHelper;
