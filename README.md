# 🐦 Twitter Clone (Node.js + Express + SQLite)

A simple Twitter-like backend built with **Node.js**, **Express**, **SQLite**, **JWT Authentication**, and **bcrypt** for password hashing.  

Supports user registration, login, following system, tweeting, liking, and replies.

---

## 🚀 Features
- User **registration & login** with JWT authentication
- Users can **follow** and **unfollow**
- Users can **tweet**, **like**, **reply**, and **delete their tweets**
- View **feed**, **followers**, and **following**
- Secure endpoints with authentication middleware

---

## 📦 Tech Stack
- **Node.js**
- **Express.js**
- **SQLite**
- **bcrypt**
- **jsonwebtoken**

---

## ⚙️ Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/twitter-clone-nodejs.git
   cd twitter-clone-nodejs
2.Install dependencies:
npm install
3.Start the server:
node app.js
Or with nodemon (if installed):
nodemon app.js
4.Server runs at:
http://localhost:3000/

🔑 Authentication

Register with /register/

Login with /login/ → receive jwtToken

Use token in headers:

Authorization: Bearer <your_jwt_token>

📚 API Endpoints
Auth

POST /register/ → Register a user

POST /login/ → Login and get JWT

Tweets

GET /user/tweets/feed/ → Latest 4 tweets from people you follow

GET /user/following/ → List of people you follow

GET /user/followers/ → List of followers

GET /tweets/:tweetId/ → Tweet details (likes, replies, date)

GET /tweets/:tweetId/likes/ → List of usernames who liked

GET /tweets/:tweetId/replies/ → Replies on a tweet

GET /user/tweets/ → All tweets of logged-in user

POST /user/tweets/ → Create a tweet

DELETE /tweets/:tweetId/ → Delete your own tweet


   
   git clone https://github.com/YOUR_USERNAME/twitter-clone-nodejs.git
   cd twitter-clone-nodejs
