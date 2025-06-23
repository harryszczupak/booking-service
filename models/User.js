const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const userSchema = new Schema({
	password: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
	},
	resetToken: String,
	isAdmin: {
		type: Boolean,
		default: false,
	},
	twoFactorSecret: String,
	twoFactorEnabled: { type: Boolean, default: false },
});
const User = mongoose.model('User', userSchema);
module.exports = User;
