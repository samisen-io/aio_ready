const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

class User {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, '../data/users.db'));
        this.initDatabase();
    }

    initDatabase() {
        this.db.serialize(() => {
            // Users table
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                plan TEXT DEFAULT 'free',
                audit_count INTEGER DEFAULT 0,
                audit_count_reset_date TEXT DEFAULT CURRENT_DATE,
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Audits table
            this.db.run(`CREATE TABLE IF NOT EXISTS audits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                results TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Create indexes
            this.db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id)');
        });
    }

    async createUser(email, password) {
        return new Promise((resolve, reject) => {
            const hashedPassword = bcrypt.hashSync(password, 10);
            
            this.db.run(
                'INSERT INTO users (email, password) VALUES (?, ?)',
                [email, hashedPassword],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            reject(new Error('Email already exists'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ id: this.lastID, email, plan: 'free' });
                    }
                }
            );
        });
    }

    async authenticateUser(email, password) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (!user) {
                        reject(new Error('User not found'));
                    } else if (!bcrypt.compareSync(password, user.password)) {
                        reject(new Error('Invalid password'));
                    } else {
                        resolve(user);
                    }
                }
            );
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (!user) {
                        reject(new Error('User not found'));
                    } else {
                        resolve(user);
                    }
                }
            );
        });
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(user);
                    }
                }
            );
        });
    }

    async updateUserPlan(userId, plan, stripeCustomerId = null, stripeSubscriptionId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [plan, stripeCustomerId, stripeSubscriptionId, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async incrementAuditCount(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET audit_count = audit_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async resetMonthlyAuditCount() {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE users 
                 SET audit_count = 0, 
                     audit_count_reset_date = CURRENT_DATE 
                 WHERE date(audit_count_reset_date) < date('now', 'start of month')`,
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async canPerformAudit(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT plan, audit_count FROM users WHERE id = ?',
                [userId],
                (err, user) => {
                    if (err) {
                        reject(err);
                    } else if (!user) {
                        reject(new Error('User not found'));
                    } else {
                        const limits = {
                            free: 5,
                            pro: 50,
                            business: 200,
                            enterprise: Infinity
                        };
                        
                        const limit = limits[user.plan] || 5;
                        const canAudit = user.audit_count < limit;
                        
                        resolve({
                            canAudit,
                            currentCount: user.audit_count,
                            limit,
                            plan: user.plan
                        });
                    }
                }
            );
        });
    }

    async saveAudit(userId, url, results) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO audits (user_id, url, results) VALUES (?, ?, ?)',
                [userId, url, JSON.stringify(results)],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    }

    async getUserAudits(userId, limit = 10, offset = 0) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM audits WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [userId, limit, offset],
                (err, audits) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(audits.map(audit => ({
                            ...audit,
                            results: JSON.parse(audit.results)
                        })));
                    }
                }
            );
        });
    }

    async getAuditStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as total_users, COUNT(CASE WHEN plan != "free" THEN 1 END) as paid_users FROM users',
                (err, stats) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stats);
                    }
                }
            );
        });
    }

    async updatePassword(userId, newPassword) {
        return new Promise((resolve, reject) => {
            const hashedPassword = bcrypt.hashSync(newPassword, 10);
            
            this.db.run(
                'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedPassword, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async deleteUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM users WHERE id = ?',
                [userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = User; 