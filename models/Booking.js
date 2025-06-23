const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bookingSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: false,
		},
		hotelOffer: {
			type: Schema.Types.ObjectId,
			ref: 'Product',
			required: true,
		},
		startDate: {
			type: Date,
			required: true,
		},
		endDate: {
			type: Date,
			required: true,
		},

	},

	{ timestamps: true }
);
const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
