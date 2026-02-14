const pool = require('./db');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ──────────────────────────────────────
    // USERS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        workspace_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // WORKSPACES
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        timezone VARCHAR(100) DEFAULT 'America/New_York',
        contact_email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'inactive',
        onboarding_step INTEGER DEFAULT 1,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add FK from users → workspaces (deferred circular dep)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_users_workspace'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT fk_users_workspace
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ──────────────────────────────────────
    // WORKSPACE MEMBERS (staff + permissions)
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'staff',
        perm_inbox BOOLEAN DEFAULT true,
        perm_bookings BOOLEAN DEFAULT true,
        perm_forms BOOLEAN DEFAULT true,
        perm_inventory BOOLEAN DEFAULT false,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      )
    `);

    // ──────────────────────────────────────
    // COMMUNICATION CHANNELS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS communication_channels (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'sms')),
        config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, type)
      )
    `);

    // ──────────────────────────────────────
    // CONTACTS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        source VARCHAR(50) DEFAULT 'manual',
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // CONVERSATIONS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'open',
        automation_paused BOOLEAN DEFAULT false,
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, contact_id)
      )
    `);

    // ──────────────────────────────────────
    // MESSAGES
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'system')),
        body TEXT NOT NULL,
        sender_type VARCHAR(20) DEFAULT 'system',
        sender_id INTEGER,
        status VARCHAR(50) DEFAULT 'sent',
        sent_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // SERVICES (booking types)
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        location VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        public_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // AVAILABILITY
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        CHECK (end_time > start_time)
      )
    `);

    // ──────────────────────────────────────
    // BOOKINGS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        booked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'confirmed',
        booking_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // FORMS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS forms (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'intake',
        fields JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // FORM → SERVICE LINKS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_service_links (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE(form_id, service_id)
      )
    `);

    // ──────────────────────────────────────
    // FORM SUBMISSIONS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_submissions (
        id SERIAL PRIMARY KEY,
        form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        data JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'pending',
        submission_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
        reminder_sent BOOLEAN DEFAULT false,
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // INVENTORY ITEMS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        usage_per_booking INTEGER DEFAULT 0,
        alert_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ──────────────────────────────────────
    // AUTOMATION LOGS
    // ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_logs (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        action VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('All tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Drop all tables and recreate (for dev resets)
const resetTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS
        automation_logs, inventory_items, form_submissions, form_service_links,
        forms, bookings, availability, services, messages, conversations,
        communication_channels, workspace_members, contacts, workspaces, users
      CASCADE
    `);
    console.log('All tables dropped');
    client.release();
    await createTables();
  } catch (err) {
    console.error('Error resetting tables:', err);
    client.release();
    throw err;
  }
};

// If run directly: node initDb.js [--reset]
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  const isReset = process.argv.includes('--reset');
  (isReset ? resetTables() : createTables())
    .then(() => { console.log('Done'); process.exit(0); })
    .catch(() => process.exit(1));
}

module.exports = createTables;
