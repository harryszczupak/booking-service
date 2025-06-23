const router = require('express').Router();
const shopController = require('../controller/shop');
const isAuthContoller = require('../middleware/isAuth');

router.get('/offers', shopController.getOffer);
router.get('/offers/:offerId', shopController.getOfferDetail);

router.get('/checkout/success', shopController.checkoutSuccess);
router.get('/checkout/:bookingId', shopController.getCheckout);

router.post('/booking', shopController.postBooking);
router.get('/orders', isAuthContoller.isAuth, shopController.getOrders);

router.get('/find-order', shopController.getFindOrders);
router.post('/search-order', shopController.postFindOrders);

router.post('/delete-order', shopController.postDeleteOrder);

router.post('/posts', (req, res, next) => {
	console.log(req.body);
	res.status(200).json({ message: 'post added' });
});
module.exports = router;
