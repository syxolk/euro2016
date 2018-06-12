module.exports = {
    origin: process.env.ORIGIN || 'http://localhost:8080',
    db: {
        username: process.env.DB_USER || 'wm2018',
        password: process.env.DB_PASSWORD || '123456',
        host: process.env.DB_HOST || 'localhost',
        //port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'wm2018',
        dialect: 'postgres',
    },
    //process.env.DB_URL || 'postgres://wm2018:123456@localhost:5432/wm2018',
    httpPort: process.env.PORT || 8080,
    sessionSecret: process.env.SESSION_SECRET || 'octocat',

    // Timezone offset used for all datetime outputs (by moment.js)
    // Defaults to CEST (Central European Summer Time)
    utcOffset: process.env.UTC_OFFSET || "+0200",
    footbalDataApiKey: "get your own key at https://www.football-data.org/client/register"
};

if(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    module.exports.facebook = {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
    };
}

if(process.env.GOOGLE_APP_ID && process.env.GOOGLE_APP_SECRET) {
    module.exports.google = {
        clientID: process.env.GOOGLE_APP_ID,
        clientSecret: process.env.GOOGLE_APP_SECRET,
    };
}

module.exports.mail = process.env.MAIL_SOLUTION;
module.exports.mailFrom = process.env.MAIL_FROM;
if(process.env.MAIL_SOLUTION === "smtp") {
    module.exports.mailParams = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        // secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        }
    };
} else if(process.env.MAIL_SOLUTION === "mailgun") {
    module.exports.mailParams = {
        domain: process.env.MAILGUN_DOMAIN,
        apiKey: process.env.MAILGUN_API_KEY,
    };
}
