const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Serve files from project root

// Create database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      imagen TEXT,
      categoria TEXT,
      destacado BOOLEAN DEFAULT 0,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      icono TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correo TEXT NOT NULL UNIQUE,
      contraseña TEXT NOT NULL
    )
  `);

  // Insert sample data if table is empty
  db.get('SELECT COUNT(*) as count FROM productos', (err, row) => {
    if (err) {
      console.error('Error checking productos table:', err.message);
      return;
    }
    if (row.count === 0) {
      const sampleProducts = [
        ['The Legend of Zelda: Breath of the Wild', 'Aventura épica en el reino de Hyrule', 59.99, 'https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_656/b_white/f_auto/q_auto/ncom/software/switch/70010000000025/7137262b5a64d921e193653f8aa0b722925abc5680380ca0e18a5cfd91697f58', 'Aventura', 1],
        ['Red Dead Redemption 2', 'Historia épica del lejano oeste', 39.99, 'https://image.api.playstation.com/cdn/UP1004/CUSA03041_00/Hpl5MtwQgOVF9vJqlfui6SDB5Jl4oBSq.png', 'Acción', 1],
        ['Minecraft', 'Juego de construcción con bloques', 29.99, 'https://www.minecraft.net/content/dam/games/minecraft/key-art/MC_2020_Game_Image.png', 'Sandbox', 1],
        ['Cyberpunk 2077', 'RPG de mundo abierto futurista', 49.99, 'https://image.api.playstation.com/vulcan/ap/rnd/202009/3021/B2AfU8bkU6W Chile6vG0Lh5O1.png', 'RPG', 0],
        ['FIFA 23', 'Simulador de fútbol', 59.99, 'https://media.contentapi.ea.com/content/dam/ea/fifa/fifa-23/images/2022/07/f23-gameplay-feat-img-16x9.jpg.adapt.crop191x100.1200w.jpg', 'Deportes', 0]
      ];
      const stmt = db.prepare(`
        INSERT INTO productos (nombre, descripcion, precio, imagen, categoria, destacado)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      sampleProducts.forEach(product => stmt.run(product));
      stmt.finalize();
      console.log('Sample data inserted.');
    }
  });
});

// API Endpoints
// Get all products or search products
app.get('/api/productos', (req, res) => {
  const searchTerm = req.query.search || '';
  let query = 'SELECT id, nombre, descripcion, precio, imagen, categoria, destacado FROM productos WHERE destacado = 1';
  const params = [];
  
  if (searchTerm) {
    query += ' AND (nombre LIKE ? OR descripcion LIKE ?)';
    params.push(`%${searchTerm}%`, `%${searchTerm}%`);
  }
  query += ' ORDER BY fecha_creacion DESC LIMIT 20';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching products:', err.message);
      res.status(500).json({ error: 'Error al cargar los productos.' });
      return;
    }
    res.json(rows);
  });
});

// Get all products for admin (with optional search)
app.get('/api/admin/productos', (req, res) => {
  const searchTerm = req.query.search || '';
  let query = 'SELECT id, nombre, precio, imagen, categoria, destacado FROM productos';
  const params = [];

  if (searchTerm) {
    query += ' WHERE nombre LIKE ? OR descripcion LIKE ? OR categoria LIKE ?';
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }
  query += ' ORDER BY fecha_creacion DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching products:', err.message);
      res.status(500).json({ error: 'Error al cargar los productos.' });
      return;
    }
    res.json(rows);
  });
});

// Get single product by ID
app.get('/api/productos/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM productos WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching product:', err.message);
      res.status(500).json({ error: 'Error al cargar el producto.' });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(row);
  });
});

// Create or update product
app.post('/api/productos', (req, res) => {
  const { id, nombre, descripcion, precio, imagen, categoria, destacado } = req.body;
  
  if (id) {
    // Update existing product
    db.run(
      `UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, imagen = ?, categoria = ?, destacado = ? WHERE id = ?`,
      [nombre, descripcion, precio, imagen || null, categoria, destacado ? 1 : 0, id],
      (err) => {
        if (err) {
          console.error('Error updating product:', err.message);
          res.status(500).json({ error: 'Error al actualizar el producto.' });
          return;
        }
        res.json({ message: 'Producto actualizado correctamente.' });
      }
    );
  } else {
    // Create new product
    db.run(
      `INSERT INTO productos (nombre, descripcion, precio, imagen, categoria, destacado) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion, precio, imagen || null, categoria, destacado ? 1 : 0],
      (err) => {
        if (err) {
          console.error('Error creating product:', err.message);
          res.status(500).json({ error: 'Error al crear el producto.' });
          return;
        }
        res.json({ message: 'Producto creado correctamente.' });
      }
    );
  }
});

// Delete product
app.delete('/api/productos/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM productos WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting product:', err.message);
      res.status(500).json({ error: 'Error al eliminar el producto.' });
      return;
    }
    res.json({ message: 'Producto eliminado correctamente.' });
  });
});

// Register new user
app.post('/api/usuarios', (req, res) => {
  const { correo, contraseña } = req.body;
  
  if (!correo || !contraseña) {
    res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    return;
  }

  db.run(
    `INSERT INTO usuarios (correo, contraseña) VALUES (?, ?)`,
    [correo, contraseña],
    (err) => {
      if (err) {
        console.error('Error creating user:', err.message);
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'El correo ya está registrado.' });
        } else {
          res.status(500).json({ error: 'Error al registrar el usuario.' });
        }
        return;
      }
      res.json({ message: 'Usuario registrado correctamente.' });
    }
  );
});

// Login user
app.post('/api/login', (req, res) => {
  const { correo, contraseña } = req.body;
  
  if (!correo || !contraseña) {
    res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    return;
  }

  db.get(
    `SELECT id, correo FROM usuarios WHERE correo = ? AND contraseña = ?`,
    [correo, contraseña],
    (err, row) => {
      if (err) {
        console.error('Error checking user:', err.message);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
        return;
      }
      if (!row) {
        res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        return;
      }
      res.json({ message: 'Inicio de sesión exitoso.', user: { id: row.id, correo: row.correo } });
    }
  );
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});