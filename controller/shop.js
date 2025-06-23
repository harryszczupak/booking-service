const HotelOffer = require('../models/HotelOffer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { calculateTotalAmount } = require('../utils/totalAmount');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');
const Booking = require('../models/Booking');

const formatDate = (date) => new Date(date).toLocaleDateString('pl-PL');

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.GMAIL_USER, //
		pass: process.env.GMAIL_APP_PASSWORD,
	},
});

exports.getOffer = async (req, res, next) => {
	const page = +req.query.page || 1;
	const itemsPerPage = 6;
	try {
		const totalOffers = await HotelOffer.countDocuments();
		const offers = await HotelOffer.find()
			.skip((page - 1) * itemsPerPage)
			.limit(itemsPerPage);

		res.render('shop/offer-list', {
			pageTitle: 'Oferty',
			offers: offers,
			path: '/offers',
			currentPage: page,
			nexPage: page + 1,
			prevPage: page - 1,
			hasPreviousPage: page > 1,
			hasNextPage: itemsPerPage * page < totalOffers,
			lastPage: Math.ceil(totalOffers / itemsPerPage),
		});
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};
exports.getOfferDetail = async (req, res, next) => {
	const offerId = req.params.offerId;
	try {
		const offer = await HotelOffer.findById(offerId);
		if (!offer) {
			return res
				.status(404)
				.render('404', { pageTitle: 'Nie znaleziono oferty' });
		}
		res.render('shop/offer-detail', {
			pageTitle: offer.name,
			offer: offer,
			path: '/offers',
		});
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};
exports.checkoutSuccess = async (req, res) => {
	const bookingId = req.query.bookingId;

	if (!bookingId) {
		return res.status(400).send('Brak identyfikatora rezerwacji.');
	}

	try {
		const booking = await Booking.findById(bookingId).populate('hotelOffer');
		if (!booking) {
			return res.status(404).send('Nie znaleziono rezerwacji.');
		}
		const { totalAmount, numNights } = calculateTotalAmount(
			booking.startDate,
			booking.endDate,
			booking.hotelOffer.pricePerNight
		);

		await transporter.sendMail({
			to: req.user.email,
			from: process.env.GMAIL_USER,
			subject: 'Potwierdzenie rezerwacji hotelu',
			html: `
			<img src="cid:hotelImage" alt="Zdjęcie hotelu" style="width: 300px; height: auto; display: block; margin-top: 15px;" />
        <h2>Potwierdzenie rezerwacji</h2>
        <p>Dziękujemy za dokonanie rezerwacji w hotelu <strong>${
					booking.hotelOffer.name
				}</strong>.</p>
        <p><strong>Numer rezerwacji:</strong> ${booking._id}</p>
        <p><strong>Termin pobytu:</strong> od ${formatDate(
					booking.startDate
				)} do ${formatDate(booking.endDate)}</p>
        <p><strong>Liczba nocy:</strong> ${numNights}</p>
        <p><strong>Łączna kwota:</strong> ${totalAmount.toFixed(2)} zł</p>
        <p style="font-size: 14px;">
			W razie pytań prosimy o kontakt:<br/>
			📞 Telefon: <a href="tel:+48573296433">+48 573 296 433</a><br/>
			📧 E-mail: <a href="mailto:kontakt@travelly.pl">hotel-service@gmail.com</a>
		</p>
      `,
			attachments: [
				{
					filename: 'hotel.jpg',
					path: path.join(__dirname, '..', booking.hotelOffer.images[0]), // np. /images/hotel.jpg
					cid: 'hotelImage', // Content-ID używany w HTML
				},
			],
		});
		res.render('shop/checkout-success', {
			pageTitle: 'Rezerwacja zakończona sukcesem',
			booking,
			path: '',
			hotelOffer: booking.hotelOffer,
		});
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};
exports.getOrders = async (req, res) => {
	try {
		const objectId = new mongoose.Types.ObjectId(req.user._id);

		const orders = await Booking.find({ user: objectId })
			.populate('user')
			.populate('hotelOffer');
		const enhancedOrders = orders.map((order) => {
			const { startDate, endDate, hotelOffer } = order;
			const { pricePerNight } = hotelOffer;

			const { totalAmount, numNights } = calculateTotalAmount(
				startDate,
				endDate,
				pricePerNight
			);

			return {
				...order._doc,
				totalAmount,
				numNights,
			};
		});
		res.render('shop/orders', {
			pageTitle: 'Twoje zamówienia',
			orders: enhancedOrders,
			path: '',
		});
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};

exports.getFindOrders = (req, res) => {
	res.render('shop/findOrder', {
		pageTitle: 'Znajdź zamówienie',
		path: 'find-offers',
	});
};
exports.postFindOrders = async (req, res) => {
	const bookingId = req.body.orderId.trim();
	const objectId = new mongoose.Types.ObjectId(bookingId);
	try {
		const orders = await Booking.find({ _id: objectId }).populate('hotelOffer');
		const enhancedOrders = orders.map((order) => {
			const { startDate, endDate, hotelOffer } = order;
			const { pricePerNight } = hotelOffer;

			const { totalAmount, numNights } = calculateTotalAmount(
				startDate,
				endDate,
				pricePerNight
			);

			return {
				...order._doc,
				totalAmount,
				numNights,
			};
		});
		res.render('shop/orders', {
			pageTitle: 'Twoje zamówienia',
			orders: enhancedOrders,
			path: '',
		});
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};

exports.postBooking = async (req, res) => {
	try {
		const { hotelId, startDate, endDate } = req.body;

		if (!hotelId || !startDate || !endDate) {
			return res.status(400).send('Brak wymaganych danych.');
		}

		const overlappingBooking = await Booking.findOne({
			hotelOffer: hotelId,
			$or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
		});

		if (overlappingBooking) {
			return res
				.status(400)
				.send('Obiekt jest już zarezerwowany w tym terminie.');
		}

		const booking = await Booking.create({
			user: req.user._id,
			hotelOffer: hotelId,
			startDate,
			endDate,
		});

		res.redirect(`/checkout/${booking._id}`);
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};

exports.getCheckout = async (req, res, next) => {
	const bookingId = req.params.bookingId;
	if (!bookingId) {
		return res.status(400).send('Brak identyfikatora rezerwacji.');
	}

	try {
		const booking = await Booking.findById(bookingId).populate('hotelOffer');
		if (!booking) {
			return res.status(404).send('Rezerwacja nie znaleziona.');
		}

		const hotelOffer = booking.hotelOffer;
		const { totalAmount, numNights } = calculateTotalAmount(
			booking.startDate,
			booking.endDate,
			booking.hotelOffer.pricePerNight
		);

		const totalAmountFixed = Math.round(
			hotelOffer.pricePerNight * numNights * 100
		);

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card', 'blik'],
			line_items: [
				{
					price_data: {
						currency: 'pln',
						product_data: {
							name: `Rezerwacja: ${hotelOffer.name} (${numNights} noclegi)`,
						},
						unit_amount: totalAmountFixed,
					},
					quantity: 1,
				},
			],
			mode: 'payment',
			success_url: `${req.protocol}://${req.get(
				'host'
			)}/checkout/success?bookingId=${booking._id}`,
			cancel_url: `${req.protocol}://${req.get('host')}/checkout/cancel`,
		});

		res.render('shop/checkout', {
			pageTitle: 'Checkout',
			path: '/checkout',
			sessionId: session.id,
			hotelOffer: hotelOffer,
			booking: booking,
			totalAmount: totalAmountFixed / 100,
			numNights: numNights,
		});
	} catch (err) {
		console.error('Stripe/checkout error:', err);
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
};
exports.postDeleteOrder = async (req, res) => {
	const deleteOrderId = req.body.deleteOrderId.trim();
	const objectId = new mongoose.Types.ObjectId(deleteOrderId);
	const booking = await Booking.findById(objectId).populate('hotelOffer');

	const start = new Date(booking.startDate);
	const end = new Date(booking.endDate);
	const numNights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
	const totalAmount =
		booking.totalPrice || numNights * booking.hotelOffer.pricePerNight;

	try {
		await transporter.sendMail({
			to: req.user.email,
			from: process.env.GMAIL_USER,
			subject: 'Anulowanie rezerwacji hotelu',
			html: `
	<img src="cid:hotelImage" alt="Zdjęcie hotelu" style="width: 300px; height: auto; display: block; margin-top: 15px;" />
	<h2>Rezerwacja anulowana</h2>
	<p>Twoja rezerwacja w hotelu <strong>${
		booking.hotelOffer.name
	}</strong> została pomyślnie anulowana.</p>
	<p><strong>Numer rezerwacji:</strong> ${booking._id}</p>
	<p><strong>Planowany termin pobytu:</strong> od ${formatDate(
		booking.startDate
	)} do ${formatDate(booking.endDate)}</p>
	<p><strong>Liczba nocy:</strong> ${numNights}</p>
	<p><strong>Łączna kwota rezerwacji:</strong> ${totalAmount.toFixed(2)} zł</p>
	<p style="margin-top: 20px;">
		Jest nam bardzo przykro, że musiałeś/aś anulować swoją rezerwację. Mamy nadzieję, że wkrótce znów będziemy mieli przyjemność gościć Cię w jednym z naszych hoteli.
	</p>
	<p>Jeśli opłata została już pobrana, środki zostaną zwrócone zgodnie z regulaminem anulacji.</p>
	<p style="font-size: 14px;">
		W razie pytań prosimy o kontakt:<br/>
		📞 Telefon: <a href="tel:+48573296433">+48 573 296 433</a><br/>
		📧 E-mail: <a href="mailto:kontakt@travelly.pl">hotel-service@gmail.com</a>
	</p>
	`,
			attachments: [
				{
					filename: 'hotel.jpg',
					path: path.join(__dirname, '..', booking.hotelOffer.images[0]), // np. /images/hotel.jpg
					cid: 'hotelImage',
				},
			],
		});
		await Booking.findByIdAndDelete(objectId);
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		next(error);
	}
	res.redirect('/profile');
};
