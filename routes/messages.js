import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

function pairIds(a, b) {
  return a < b ? [a, b] : [b, a];
}

async function getOrCreateConversation(userA, userB) {
  const [user1_id, user2_id] = pairIds(userA, userB);
  const existing = await pool.query(
    "SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2",
    [user1_id, user2_id]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const created = await pool.query(
    "INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING id",
    [user1_id, user2_id]
  );
  return created.rows[0].id;
}

/**
 * @swagger
 * /api/messages/users:
 *   get:
 *     summary: List users available for chat
 *     description: Returns all users except the current user, with unread counts and last message preview.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       email: { type: string }
 *                       role: { type: string }
 *                       avatar: { type: string }
 *                       unread_count: { type: integer }
 *                       last_message: { type: string }
 *                       last_message_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 */
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar,
        COALESCE(unread.count, 0)::int AS unread_count,
        lm.body AS last_message,
        lm.created_at AS last_message_at
      FROM users u
      LEFT JOIN conversations c ON (
        (c.user1_id = $1 AND c.user2_id = u.id) OR
        (c.user2_id = $1 AND c.user1_id = u.id)
      )
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM chat_messages cm
        WHERE cm.conversation_id = c.id
          AND cm.sender_id != $1
          AND cm.is_read = false
      ) unread ON true
      LEFT JOIN LATERAL (
        SELECT body, created_at
        FROM chat_messages cm
        WHERE cm.conversation_id = c.id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) lm ON true
      WHERE u.id != $1
      ORDER BY COALESCE(lm.created_at, u.created_at) DESC, u.name ASC`,
      [req.user.id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/messages/notifications:
 *   get:
 *     summary: Get unread message notifications
 *     description: Returns unread chat notifications for the header bell dropdown.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unread:
 *                   type: integer
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       body: { type: string }
 *                       created_at: { type: string, format: date-time }
 *                       sender_id: { type: integer }
 *                       sender_name: { type: string }
 *                       sender_avatar: { type: string }
 *                       other_user_id: { type: integer }
 *       401:
 *         description: Unauthorized
 */
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        cm.id,
        cm.body,
        cm.created_at,
        cm.sender_id,
        u.name AS sender_name,
        u.avatar AS sender_avatar,
        CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END AS other_user_id
      FROM chat_messages cm
      JOIN conversations c ON cm.conversation_id = c.id
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.sender_id != $1
        AND cm.is_read = false
        AND (c.user1_id = $1 OR c.user2_id = $1)
      ORDER BY cm.created_at DESC
      LIMIT 20`,
      [req.user.id]
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS unread
      FROM chat_messages cm
      JOIN conversations c ON cm.conversation_id = c.id
      WHERE cm.sender_id != $1
        AND cm.is_read = false
        AND (c.user1_id = $1 OR c.user2_id = $1)`,
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unread: unreadResult.rows[0].unread
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/messages/read-all:
 *   patch:
 *     summary: Mark all messages as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All messages marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 */
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE chat_messages cm
       SET is_read = true
       FROM conversations c
       WHERE cm.conversation_id = c.id
         AND cm.sender_id != $1
         AND cm.is_read = false
         AND (c.user1_id = $1 OR c.user2_id = $1)`,
      [req.user.id]
    );
    res.json({ message: "All messages marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/messages/conversations/{userId}/messages:
 *   get:
 *     summary: Get chat thread with a user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the other user in the conversation
 *     responses:
 *       200:
 *         description: Conversation messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation_id: { type: integer }
 *                 other_user:
 *                   $ref: '#/components/schemas/User'
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Invalid user
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Send a message to a user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageInput'
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Invalid user or empty message
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get("/conversations/:userId/messages", authMiddleware, async (req, res) => {
  const otherUserId = parseInt(req.params.userId, 10);
  const currentUserId = req.user.id;

  if (!otherUserId || otherUserId === currentUserId) {
    return res.status(400).json({ error: "Invalid user" });
  }

  try {
    const userCheck = await pool.query("SELECT id, name, email, role, avatar FROM users WHERE id = $1", [otherUserId]);
    if (!userCheck.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversationId = await getOrCreateConversation(currentUserId, otherUserId);

    const messages = await pool.query(
      `SELECT cm.id, cm.body, cm.sender_id, cm.is_read, cm.created_at,
        u.name AS sender_name, u.avatar AS sender_avatar
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.conversation_id = $1
      ORDER BY cm.created_at ASC`,
      [conversationId]
    );

    res.json({
      conversation_id: conversationId,
      other_user: userCheck.rows[0],
      messages: messages.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send message to a user
router.post("/conversations/:userId/messages", authMiddleware, async (req, res) => {
  const otherUserId = parseInt(req.params.userId, 10);
  const currentUserId = req.user.id;
  const { body } = req.body;

  if (!otherUserId || otherUserId === currentUserId) {
    return res.status(400).json({ error: "Invalid user" });
  }

  if (!body || !body.trim()) {
    return res.status(400).json({ error: "Message body is required" });
  }

  try {
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [otherUserId]);
    if (!userCheck.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const conversationId = await getOrCreateConversation(currentUserId, otherUserId);

    const result = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, sender_id, is_read, created_at`,
      [conversationId, currentUserId, body.trim()]
    );

    await pool.query(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [conversationId]
    );

    const sender = await pool.query(
      "SELECT name, avatar FROM users WHERE id = $1",
      [currentUserId]
    );

    res.status(201).json({
      ...result.rows[0],
      sender_name: sender.rows[0].name,
      sender_avatar: sender.rows[0].avatar
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/messages/conversations/{userId}/read:
 *   patch:
 *     summary: Mark conversation with a user as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversation marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid user
 *       401:
 *         description: Unauthorized
 */
router.patch("/conversations/:userId/read", authMiddleware, async (req, res) => {
  const otherUserId = parseInt(req.params.userId, 10);
  const currentUserId = req.user.id;

  if (!otherUserId || otherUserId === currentUserId) {
    return res.status(400).json({ error: "Invalid user" });
  }

  try {
    const [user1_id, user2_id] = pairIds(currentUserId, otherUserId);
    const conv = await pool.query(
      "SELECT id FROM conversations WHERE user1_id = $1 AND user2_id = $2",
      [user1_id, user2_id]
    );

    if (!conv.rows.length) {
      return res.json({ message: "No conversation yet" });
    }

    await pool.query(
      `UPDATE chat_messages
       SET is_read = true
       WHERE conversation_id = $1 AND sender_id = $2 AND is_read = false`,
      [conv.rows[0].id, otherUserId]
    );

    res.json({ message: "Conversation marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
