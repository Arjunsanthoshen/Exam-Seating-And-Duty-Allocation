const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Load environment variables if present
try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
    // Continue with existing environment
}

function getDbConfig() {
    const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (connectionUri) {
        try {
            const url = new URL(connectionUri);
            return {
                host: url.hostname,
                port: Number(url.port) || 3306,
                user: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                database: url.pathname.replace(/^\//, ''),
                multipleStatements: true,
                ssl: process.env.DB_SSL === 'false' ? undefined : (process.env.DB_SSL === 'true' || url.searchParams.get('ssl') ? { rejectUnauthorized: false } : undefined)
            };
        } catch (e) {
            // fallback to direct URI
            return { uri: connectionUri, multipleStatements: true };
        }
    }

    const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
    const port = Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306;
    const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
    const password = process.env.MYSQLPASSWORD !== undefined
        ? process.env.MYSQLPASSWORD
        : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.NODE_ENV === 'production' ? '' : 'tree'));
    const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'college';

    const config = {
        host,
        port,
        user,
        password,
        database,
        multipleStatements: true
    };

    if (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true') {
        config.ssl = { rejectUnauthorized: false };
    }

    return config;
}

async function init() {
    console.log('====================================================');
    console.log(' DATABASE INITIALIZATION / MIGRATION SCRIPT');
    console.log('====================================================');

    const config = getDbConfig();
    console.log(`Connecting to database: ${config.database || 'default'} on ${config.host || 'URI'}:${config.port || 3306}...`);

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected successfully to MySQL server.');
    } catch (connErr) {
        console.error('Failed to connect to database:', connErr.message);
        console.error('Please verify your DB environment variables (MYSQL_URL, MYSQLHOST, DB_HOST, etc.)');
        process.exit(1);
    }

    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema.sql DDL...');
        await connection.query(schemaSql);
        console.log('All 13 database tables and constraints verified successfully.');

        // Check if an admin user already exists
        const [adminRows] = await connection.query(
            "SELECT username FROM Users WHERE LOWER(role) = 'admin' LIMIT 1"
        );

        if (adminRows.length > 0) {
            console.log(`Administrator account exists (${adminRows[0].username}). No new admin created.`);
        } else {
            console.log('No administrator found. Bootstrapping initial admin account...');
            const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME || 'admin@sjcetpalai.ac.in';
            const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Exam2026!';
            const passwordHash = await bcrypt.hash(adminPassword, 10);

            await connection.query(
                "INSERT INTO Users (username, role, password) VALUES (?, 'admin', ?)",
                [adminEmail, passwordHash]
            );

            console.log('----------------------------------------------------');
            console.log(' Initial Admin Created Successfully:');
            console.log(` Username / Email: ${adminEmail}`);
            if (process.env.ADMIN_PASSWORD) {
                console.log(' Password: (as provided in ADMIN_PASSWORD environment variable)');
            } else {
                console.log(` Default Password: ${adminPassword}`);
                console.log(' IMPORTANT: Change this password immediately after logging in!');
            }
            console.log('----------------------------------------------------');
        }

        console.log('Database initialization complete.');
    } catch (err) {
        console.error('Error executing database setup:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

init();
