// Serverless function (Vercel/Node) — CRUD dos campeonatos, guardados no Postgres (Neon).
// GET  -> lista todos os campeonatos (cada um com seu balizamento completo)
// PUT  -> substitui a lista inteira (upsert dos que vieram, apaga os que sumiram)
const { neon } = require('@neondatabase/serverless');

let schemaReady = null;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada — provisione o Postgres (Neon) no projeto Vercel.');
  }
  return neon(process.env.DATABASE_URL);
}

function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS campeonatos (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  }
  return schemaReady;
}

module.exports = async (req, res) => {
  let sql;
  try {
    sql = getSql();
    await ensureSchema(sql);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db_unavailable', message: e.message });
    return;
  }

  if (req.method === 'GET') {
    const rows = await sql`SELECT payload FROM campeonatos ORDER BY updated_at DESC`;
    res.status(200).json(rows.map(r => r.payload));
    return;
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'expected_array' });
      return;
    }
    const ids = body.map(c => c && c.id).filter(Boolean);
    await sql`DELETE FROM campeonatos WHERE NOT (id = ANY(${ids}))`;
    for (const camp of body) {
      if (!camp || !camp.id) continue;
      await sql`
        INSERT INTO campeonatos (id, payload, updated_at)
        VALUES (${camp.id}, ${JSON.stringify(camp)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
      `;
    }
    res.status(200).json({ ok: true, count: body.length });
    return;
  }

  res.setHeader('Allow', 'GET, PUT');
  res.status(405).json({ error: 'method_not_allowed' });
};
