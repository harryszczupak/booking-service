const express = require('express');
const router = express.Router();
const authController = require('../controller/auth');
const { body } = require('express-validator');
const User = require('../models/User');
const isAuthContoller = require('../middleware/isAuth');

router.get('/login', authController.getLogin);

router.post(
	'/login',
	[
		body('email').isEmail().withMessage('Proszę podać poprawny adres e-mail.'),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Hasło musi mieć co najmniej 6 znaków.'),
	],
	authController.postLogin
);
router.get('/signup', authController.getSignup);

router.post(
	'/signup',
	[
		body('email')
			.isEmail()
			.withMessage('Proszę podać poprawny adres e-mail.')
			.custom(async (value) => {
				const existingUser = await User.findOne({ email: value });
				if (existingUser) {
					throw new Error('Użytkownik z tym adresem e-mail już istnieje.');
				}
				return true;
			}),

		body('password')
			.isLength({ min: 6 })
			.withMessage('Hasło musi mieć co najmniej 6 znaków.'),
		body('confirmPassword').custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error('Hasła muszą być identyczne.');
			}
			return true;
		}),
	],
	authController.postSignup
);
router.get('/profile', isAuthContoller.isAuth, authController.getProfile);

router.post('/logout', authController.postLogout);
router.post('/reset-password', authController.postResetPassword);
router.get('/verify-2fa-setup', authController.getVerify2FASetup);
router.post('/verify-2fa-setup', authController.postVerify2FASetup);
module.exports = router;
