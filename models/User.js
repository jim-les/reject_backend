const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  accountId: String,
  initials: String,
  balance: Number,
  number: Number,
});

module.exports = mongoose.model('User', UserSchema);
