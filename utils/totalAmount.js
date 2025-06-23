exports.calculateTotalAmount = (startDate, endDate, pricePerNight) => {
	const start = new Date(startDate);
	const end = new Date(endDate);
	const oneDay = 1000 * 60 * 60 * 24;
	const numNights = Math.ceil((end - start) / oneDay);

	const totalAmount = pricePerNight * numNights;

	return {
		totalAmount,
		numNights,
	};
};
