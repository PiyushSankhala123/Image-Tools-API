# Image Tools API

A Node.js/Express REST API for user authentication and server-side image processing. Users register, log in with JWT-based auth, upload images, and apply transformations (resize, format conversion, brightness/contrast, and target-size compression) powered by [sharp](https://sharp.pixelplumbing.com/).

## Features

- **User authentication** — register/login with hashed passwords (bcrypt) and JWT tokens
- **Image upload & processing** — resize, convert format (jpeg/png/webp), adjust brightness/contrast
- **Target-size compression** — binary-search the JPEG/WebP quality setting to hit a target file size (KB)
- **Per-user image history** — processed images are linked to the uploading user and listed on their profile
- **Image management** — delete a single processed image or clear all of a user's images

## Tech Stack

- [Express 5](https://expressjs.com/) — HTTP server & routing
- [Mongoose](https://mongoosejs.com/) / MongoDB — data storage
- [sharp](https://sharp.pixelplumbing.com/) — image processing
- [multer](https://github.com/expressjs/multer) — multipart file uploads (in-memory storage)
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — auth
- [dotenv](https://github.com/motdotla/dotenv), [cors](https://github.com/expressjs/cors)

## Project Structure

```
.
├── server.js              # App entry point, DB connection, middleware & route mounting
├── middleware/
│   └── auth.js             # JWT verification middleware (protect)
├── models/
│   ├── User.js              # User schema (username, email, password)
│   └── Image.js              # Processed image schema
├── routes/
│   ├── auth.js               # /api/auth routes
│   └── image.js               # /api/image routes
└── package.json
```

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- A MongoDB instance (local or Atlas)

### Installation

```bash
git clone https://github.com/PiyushSankhala123/Image-Tools-API.git
cd Image-Tools-API
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/image-tools
JWT_SECRET=your_jwt_secret_here
```

### Run the server

```bash
node server.js
```

The API will start on `http://localhost:3000` (or the port set in `.env`), and processed images are served statically from `/processed`.

## API Reference

All authenticated routes require an `Authorization: Bearer <token>` header, using the token returned from register/login.

### Auth — `/api/auth`

| Method | Endpoint    | Auth | Description                                   |
|--------|-------------|------|------------------------------------------------|
| POST   | `/register` | No   | Create a user. Body: `username`, `email`, `password` |
| POST   | `/login`    | No   | Log in. Body: `email`, `password`             |
| GET    | `/profile`  | Yes  | Get the current user's profile and their uploaded images |

### Images — `/api/image`

| Method | Endpoint      | Auth | Description                                      |
|--------|---------------|------|---------------------------------------------------|
| POST   | `/process`    | Yes  | Upload and process an image (multipart form, field name `image`) |
| DELETE | `/:id`        | Yes  | Delete a single processed image by its DB id       |
| DELETE | `/clear-all`  | Yes  | Delete all of the current user's processed images  |

#### `POST /api/image/process` form fields

| Field          | Type   | Description                                              |
|----------------|--------|------------------------------------------------------------|
| `image`        | file   | Required. Accepts jpeg, jpg, png, webp                     |
| `format`       | string | Output format (`jpeg`, `png`, `webp`). Default: `jpeg`     |
| `width`        | number | Output width in px (requires `height` too)                 |
| `height`       | number | Output height in px (requires `width` too)                  |
| `compressSize` | number | Target file size in KB (jpeg/webp only); quality is binary-searched to fit |
| `brightness`   | number | Brightness multiplier (e.g. `1.0` = unchanged)              |
| `contrast`     | number | Contrast value, recorded alongside brightness adjustments   |

Example with `curl`:

```bash
curl -X POST http://localhost:3000/api/image/process \
  -H "Authorization: Bearer <token>" \
  -F "image=@photo.jpg" \
  -F "format=webp" \
  -F "width=800" \
  -F "height=600" \
  -F "compressSize=200"
```

## Notes

- Uploaded files are validated by both MIME type and extension (jpeg/jpg/png/webp only).
- Processed files are written to a `processed/` directory at the project root (created automatically if missing) and served at `/processed/<filename>`.
- Passwords are hashed with bcrypt before being stored; the password field is excluded from queries by default (`select: false`).
