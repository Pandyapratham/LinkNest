const mongoose = require("mongoose");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: EMAIL_PATTERN,
    unique: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 24,
    match: USERNAME_PATTERN,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, result) {
      delete result.passwordHash;
      delete result.__v;
      return result;
    },
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
