// app.js
const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')

const app = express()
app.use(express.json())

const DB_PATH = path.join(__dirname, 'twitterClone.db')
const JWT_SECRET = 'MY_SECRET_TOKEN' // change in production

let db = null

// initialize DB connection
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error :${e.message}`)
    process.exit(1)
  }
}
initializeDBAndServer()

/* -------------------------
   Middleware: authenticate JWT
   ------------------------- */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    return res.status(401).send('Invalid JWT Token')
  }
  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).send('Invalid JWT Token')
  }
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).send('Invalid JWT Token')
    }
    
    req.user = {
      userId: payload.userId,
      username: payload.username,
    }
    next()
  })
}

/* -------------------------
   API 1: Register - POST /register/
   ------------------------- */
app.post('/register/', async (req, res) => {
  try {
    const {username, password, name, gender} = req.body
    const existing = await db.get(
      `SELECT * FROM user WHERE username = ?`,
      username,
    )
    if (existing) {
      return res.status(400).send('User already exists')
    }

    if (password.length < 6) {
      return res.status(400).send('Password is too short')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const insertQuery = `
      INSERT INTO user (name, username, password, gender)
      VALUES (?, ?, ?, ?)
    `
    await db.run(insertQuery, [name, username, hashedPassword, gender])

    return res.status(200).send('User created successfully')
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 2: Login - POST /login/
   ------------------------- */
app.post('/login/', async (req, res) => {
  try {
    const {username, password} = req.body
    const user = await db.get(`SELECT * FROM user WHERE username = ?`, username)
    if (!user) {
      return res.status(400).send('Invalid user')
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(400).send('Invalid password')
    }

    const payload = {username: user.username, userId: user.user_id}
    const jwtToken = jwt.sign(payload, JWT_SECRET)

    return res.status(200).json({jwtToken})
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 3: GET /user/tweets/feed/
   Returns latest 4 tweets from people the user follows
   ------------------------- */
app.get('/user/tweets/feed/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const tweetsQuery = `
      SELECT u.username AS username, t.tweet AS tweet, t.date_time AS dateTime
      FROM follower f
      JOIN tweet t ON f.following_user_id = t.user_id
      JOIN user u ON t.user_id = u.user_id
      WHERE f.follower_user_id = ?
      ORDER BY t.date_time DESC
      LIMIT 4
    `
    const tweets = await db.all(tweetsQuery, userId)

    const response = tweets.map(r => ({
      username: r.username,
      tweet: r.tweet,
      dateTime: r.dateTime,
    }))

    return res.status(200).json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 4: GET /user/following/
   Returns list of names whom the user follows
   ------------------------- */
app.get('/user/following/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    const query = `
      SELECT u.name AS name
      FROM follower f
      JOIN user u ON f.following_user_id = u.user_id
      WHERE f.follower_user_id = ?
    `
    const rows = await db.all(query, userId)

    return res.status(200).json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 5: GET /user/followers/
   Returns list of names who follow the user
   ------------------------- */
app.get('/user/followers/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    const query = `
      SELECT u.name AS name
      FROM follower f
      JOIN user u ON f.follower_user_id = u.user_id
      WHERE f.following_user_id = ?
    `
    const rows = await db.all(query, userId)

    return res.status(200).json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   Helper: check if target tweet belongs to someone the user follows
   ------------------------- */
const isTweetFromFollowed = async (requesterId, tweetId) => {
  const q = `
    SELECT 1
    FROM tweet t
    JOIN follower f ON t.user_id = f.following_user_id
    WHERE t.tweet_id = ? AND f.follower_user_id = ?
    LIMIT 1
  `
  const row = await db.get(q, tweetId, requesterId)
  return !!row
}

/* -------------------------
   API 6: GET /tweets/:tweetId/
   Returns tweet details (tweet, likes, replies, dateTime) if allowed
   ------------------------- */
app.get('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  try {
    const {tweetId} = req.params
    const userId = req.user.userId

    const allowed = await isTweetFromFollowed(userId, tweetId)
    if (!allowed) {
      return res.status(401).send('Invalid Request')
    }

    const tweetRow = await db.get(
      `SELECT tweet, date_time AS dateTime FROM tweet WHERE tweet_id = ?`,
      tweetId,
    )
    if (!tweetRow) {
      return res.status(404).send('Tweet not found')
    }

    const likesRow = await db.get(
      `SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ?`,
      tweetId,
    )
    const repliesRow = await db.get(
      `SELECT COUNT(*) AS replies FROM reply WHERE tweet_id = ?`,
      tweetId,
    )

    const response = {
      tweet: tweetRow.tweet,
      likes: likesRow ? likesRow.likes : 0,
      replies: repliesRow ? repliesRow.replies : 0,
      dateTime: tweetRow.dateTime,
    }

    return res.status(200).json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 7: GET /tweets/:tweetId/likes/
   Returns list of usernames who liked the tweet (if allowed)
   ------------------------- */
app.get('/tweets/:tweetId/likes/', authenticateToken, async (req, res) => {
  try {
    const {tweetId} = req.params
    const userId = req.user.userId

    const allowed = await isTweetFromFollowed(userId, tweetId)
    if (!allowed) {
      return res.status(401).send('Invalid Request')
    }

    const query = `
      SELECT u.username
      FROM like l
      JOIN user u ON l.user_id = u.user_id
      WHERE l.tweet_id = ?
    `
    const rows = await db.all(query, tweetId)
    const usernames = rows.map(r => r.username)

    return res.status(200).json({likes: usernames})
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 8: GET /tweets/:tweetId/replies/
   Returns list of replies with name and reply (if allowed)
   ------------------------- */
app.get('/tweets/:tweetId/replies/', authenticateToken, async (req, res) => {
  try {
    const {tweetId} = req.params
    const userId = req.user.userId

    const allowed = await isTweetFromFollowed(userId, tweetId)
    if (!allowed) {
      return res.status(401).send('Invalid Request')
    }

    const query = `
      SELECT u.name AS name, r.reply AS reply
      FROM reply r
      JOIN user u ON r.user_id = u.user_id
      WHERE r.tweet_id = ?
    `
    const rows = await db.all(query, tweetId)

    return res.status(200).json({replies: rows})
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 9: GET /user/tweets/
   Returns all tweets of the authenticated user with likes, replies, dateTime
   ------------------------- */
app.get('/user/tweets/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    const tweets = await db.all(
      `SELECT tweet_id, tweet, date_time AS dateTime
       FROM tweet
       WHERE user_id = ?
       ORDER BY date_time DESC`,
      userId,
    )

    const results = []
    for (const t of tweets) {
      const likesRow = await db.get(
        `SELECT COUNT(*) AS likes FROM like WHERE tweet_id = ?`,
        t.tweet_id,
      )
      const repliesRow = await db.get(
        `SELECT COUNT(*) AS replies FROM reply WHERE tweet_id = ?`,
        t.tweet_id,
      )

      results.push({
        tweet: t.tweet,
        likes: likesRow ? likesRow.likes : 0,
        replies: repliesRow ? repliesRow.replies : 0,
        dateTime: t.dateTime,
      })
    }

    return res.status(200).json(results)
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 10: POST /user/tweets/
   Create a tweet for authenticated user
   ------------------------- */
app.post('/user/tweets/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const {tweet} = req.body

    const dateTime = new Date().toISOString() // store ISO string
    await db.run(
      `INSERT INTO tweet (tweet, user_id, date_time) VALUES (?, ?, ?)`,
      tweet,
      userId,
      dateTime,
    )

    return res.status(200).send('Created a Tweet')
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

/* -------------------------
   API 11: DELETE /tweets/:tweetId/
   Delete a tweet only if it belongs to authenticated user
   ------------------------- */
app.delete('/tweets/:tweetId/', authenticateToken, async (req, res) => {
  try {
    const {tweetId} = req.params
    const userId = req.user.userId

    const tweet = await db.get(
      `SELECT * FROM tweet WHERE tweet_id = ?`,
      tweetId,
    )
    if (!tweet) {
      return res.status(404).send('Tweet not found')
    }

    if (tweet.user_id !== userId) {
      return res.status(401).send('Invalid Request')
    }

    await db.run(`DELETE FROM tweet WHERE tweet_id = ?`, tweetId)
    return res.status(200).send('Tweet Removed')
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
})

module.exports = app
