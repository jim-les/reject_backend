const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  senderId: String,
  receiverIds: [String],
  amount: Number,
  status: String,
});

module.exports = mongoose.model('Transaction', TransactionSchema);
