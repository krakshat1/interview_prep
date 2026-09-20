// Runs candidate SQL against an in-memory SQLite database (sql.js - pure
// WASM, no native compilation needed, so it installs cleanly on any
// platform). Every SQL practice problem shares the same seeded schema so
// problems can build on each other (joins across the same two tables).
const path = require('path');

let SQLPromise = null;
function getSQL() {
  if (!SQLPromise) {
    const initSqlJs = require('sql.js');
    // Point locateFile at the installed package's dist dir so the wasm
    // binary resolves correctly regardless of process cwd.
    SQLPromise = initSqlJs({
      locateFile: (file) => path.join(require.resolve('sql.js/dist/sql-wasm.js'), '..', file),
    });
  }
  return SQLPromise;
}

// Two tables: customers and their orders. Includes an exact-duplicate order
// pair (order_id 18 vs 19) so the deduplication problem has something real
// to deduplicate, and orders span three months for the month-over-month
// trend problem.
const SEED_SQL = `
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT,
  country TEXT,
  signup_date TEXT
);
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  order_date TEXT,
  amount REAL,
  status TEXT
);

INSERT INTO customers (customer_id, name, country, signup_date) VALUES
  (1, 'Aditi Sharma', 'India', '2023-01-15'),
  (2, 'Brian Chen', 'USA', '2022-11-02'),
  (3, 'Carla Mendes', 'Brazil', '2023-03-20'),
  (4, 'Deepak Verma', 'India', '2023-06-10'),
  (5, 'Elena Petrova', 'Russia', '2022-08-05'),
  (6, 'Farid Khan', 'India', '2023-09-01'),
  (7, 'Grace Kim', 'South Korea', '2023-02-14'),
  (8, 'Hassan Ali', 'UAE', '2022-12-25'),
  (9, 'Isabella Rossi', 'Italy', '2023-04-18'),
  (10, 'Jamal Wright', 'USA', '2023-07-22');

INSERT INTO orders (order_id, customer_id, order_date, amount, status) VALUES
  (1, 1, '2024-01-05', 120.50, 'completed'),
  (2, 1, '2024-01-20', 45.00, 'completed'),
  (3, 1, '2024-02-10', 300.00, 'completed'),
  (4, 2, '2024-01-08', 15.00, 'completed'),
  (5, 3, '2024-01-15', 500.00, 'completed'),
  (6, 3, '2024-02-02', 220.00, 'cancelled'),
  (7, 3, '2024-02-25', 75.00, 'completed'),
  (8, 3, '2024-03-05', 90.00, 'completed'),
  (9, 4, '2024-01-12', 60.00, 'completed'),
  (10, 5, '2024-01-30', 410.00, 'completed'),
  (11, 5, '2024-02-14', 25.00, 'completed'),
  (12, 6, '2024-02-01', 150.00, 'completed'),
  (13, 6, '2024-02-20', 30.00, 'completed'),
  (14, 6, '2024-03-01', 60.00, 'completed'),
  (15, 7, '2024-01-18', 200.00, 'completed'),
  (16, 9, '2024-02-08', 18.00, 'completed'),
  (17, 9, '2024-03-15', 275.00, 'completed'),
  (18, 3, '2024-01-15', 500.00, 'completed'),
  (19, 3, '2024-01-15', 500.00, 'completed'),
  (20, 10, '2024-03-10', 99.00, 'completed');
`;

function execToRows(db, sql) {
  const res = db.exec(sql);
  if (!res.length) return { columns: [], rows: [] };
  const { columns, values } = res[0];
  const rows = values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
  return { columns, rows };
}

function rowsMatch(a, b) {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Runs the candidate's query and the problem's canonical expectedQuery
 * against a fresh copy of the seeded database, and compares result sets
 * (order-sensitive - most of these problems specify or imply an ORDER BY).
 */
async function runQuery({ query, expectedQuery }) {
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(SEED_SQL);

  let actual = null;
  let actualError = null;
  try {
    actual = execToRows(db, query);
  } catch (e) {
    actualError = e.message;
  }

  let expected = { columns: [], rows: [] };
  try {
    expected = execToRows(db, expectedQuery);
  } catch (e) {
    // Should never happen (expectedQuery is authored/tested), but don't crash the request.
    expected = { columns: [], rows: [] };
  }

  db.close();

  if (actualError) {
    return { matched: false, error: actualError, actualRows: [], expectedRows: expected.rows };
  }
  return {
    matched: rowsMatch(actual.rows, expected.rows),
    error: null,
    actualRows: actual.rows,
    expectedRows: expected.rows,
  };
}

module.exports = { runQuery, SEED_SQL };
