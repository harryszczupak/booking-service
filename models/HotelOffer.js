const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const hotelOfferSchema = new Schema({
	name: {
		type: String,
		required: true,
		trim: true, // usuwa białe znaki z początku i końca
	},
	description: {
		type: String,
		required: true,
	},
	pricePerNight: {
		type: Number,
		required: true,
		min: 0,
	},
	location: {
		city: { type: String, required: true },
		address: String,
	},
	availableRooms: {
		type: Number,
		default: 0,
		min: 0,
	},
	amenities: [String], // np. ["WiFi", "Basen", "Parking"]
	images: [String], // tablica URLi do zdjęć
	rating: {
		type: Number,
		min: 0,
		max: 5,
		default: 0,
	},
});
const hotelOffer = mongoose.model('Product', hotelOfferSchema);
module.exports = hotelOffer;
