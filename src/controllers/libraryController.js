const db = require('../config/database');

const getAllLibraryItems = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, u.name as creator_name
       FROM library_items l
       LEFT JOIN users u ON l.created_by = u.id
       WHERE l.is_public = true OR l.created_by = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get library items error:', error);
    res.status(500).json({ error: 'Failed to fetch library items' });
  }
};

const getLibraryItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT l.*, u.name as creator_name
       FROM library_items l
       LEFT JOIN users u ON l.created_by = u.id
       WHERE l.id = $1 AND (l.is_public = true OR l.created_by = $2)`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Get library item error:', error);
    res.status(500).json({ error: 'Failed to fetch library item' });
  }
};

const createLibraryItem = async (req, res) => {
  try {
    const { title, description, type, url, file_url, file_path, content, tags, category, is_public } = req.body;

    const result = await db.query(
      `INSERT INTO library_items (title, description, type, url, file_url, file_path, content, tags, category, is_public, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [title, description, type, url, file_url || null, file_path || null, content || null, tags || [], category || null, is_public !== false, req.user.id]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error('Create library item error:', error);
    res.status(500).json({ error: 'Failed to create library item' });
  }
};

const updateLibraryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, url, file_url, file_path, content, tags, category, is_public } = req.body;

    // Build update query dynamically to handle null values properly
    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCounter}`);
      values.push(title);
      paramCounter++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCounter}`);
      values.push(description);
      paramCounter++;
    }
    if (type !== undefined) {
      updates.push(`type = $${paramCounter}`);
      values.push(type);
      paramCounter++;
    }
    if (url !== undefined) {
      updates.push(`url = $${paramCounter}`);
      values.push(url);
      paramCounter++;
    }
    if (file_url !== undefined) {
      updates.push(`file_url = $${paramCounter}`);
      values.push(file_url);
      paramCounter++;
    }
    if (file_path !== undefined) {
      updates.push(`file_path = $${paramCounter}`);
      values.push(file_path);
      paramCounter++;
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCounter}`);
      values.push(content);
      paramCounter++;
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCounter}`);
      values.push(tags);
      paramCounter++;
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCounter}`);
      values.push(category);
      paramCounter++;
    }
    if (is_public !== undefined) {
      updates.push(`is_public = $${paramCounter}`);
      values.push(is_public);
      paramCounter++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE library_items SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Update library item error:', error);
    res.status(500).json({ error: 'Failed to update library item' });
  }
};

const deleteLibraryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM library_items WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library item not found' });
    }

    res.json({ message: 'Library item deleted successfully' });
  } catch (error) {
    console.error('Delete library item error:', error);
    res.status(500).json({ error: 'Failed to delete library item' });
  }
};

const downloadLibraryItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Get library item
    const result = await db.query(
      `SELECT * FROM library_items WHERE id = $1 AND (is_public = true OR created_by = $2)`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library item not found' });
    }

    const item = result.rows[0];

    if (!item.file_url) {
      return res.status(404).json({ error: 'No file available for download' });
    }

    // Increment download counter
    await db.query(
      'UPDATE library_items SET downloads = COALESCE(downloads, 0) + 1 WHERE id = $1',
      [id]
    );

    // Redirect to file URL
    res.redirect(item.file_url);
  } catch (error) {
    console.error('Download library item error:', error);
    res.status(500).json({ error: 'Failed to download library item' });
  }
};

module.exports = {
  getAllLibraryItems,
  getLibraryItemById,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  downloadLibraryItem
};
