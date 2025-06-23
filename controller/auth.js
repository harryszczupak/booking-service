const User = require('../models/User');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.GMAIL_USER, // np. 'twojemail@gmail.com'
		pass: process.env.GMAIL_APP_PASSWORD, // hasło aplikacji
	},
});

exports.getLogin = (req, res, next) => {
	res.render('auth/login', {
		pageTitle: 'Logowanie',
		path: '/login',
		oldInput: {
			email: '',
			password: '',
		},
		errorMessage: null,
		validationErrors: [],
	});
};

exports.postLogin = async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(422).render('auth/login', {
			pageTitle: 'Logowanie',
			path: '/login',
			oldInput: { email, password },
			errorMessage: errors.array()[0].msg,
			validationErrors: errors.array(),
		});
	}

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(401).render('auth/login', {
				pageTitle: 'Logowanie',
				path: '/login',
				oldInput: { email, password },
				errorMessage: 'Nie znaleziono użytkownika z tym adresem e-mail',
				validationErrors: [
					{
						path: 'email',
						msg: 'Nie znaleziono użytkownika z tym adresem e-mail',
						value: email,
					},
				],
			});
		}

		const doMatch = await bcrypt.compare(password, user.password);
		if (!doMatch) {
			return res.status(401).render('auth/login', {
				pageTitle: 'Logowanie',
				path: '/login',
				errorMessage: 'Nieprawidłowe hasło',
				oldInput: { email, password },
				validationErrors: [
					{ path: 'password', msg: 'Nieprawidłowe hasło', value: password },
				],
			});
		}

		// Jeśli użytkownik ma włączone 2FA, przejdź do strony weryfikacji 2FA
		if (user.twoFactorEnabled) {
			req.session.tmpUser = user._id; // przechowaj tymczasowo usera do dalszej weryfikacji
			return req.session.save(() => {
				res.redirect('/verify-2fa-setup');
			});
		}

		// Brak 2FA, loguj od razu
		req.session.isLoggedIn = true;
		req.session.user = user;
		return req.session.save((err) => {
			if (err) {
				console.error('Błąd podczas zapisywania sesji:', err);
				return res.status(500).render('500', { pageTitle: 'Błąd serwera' });
			}
			res.redirect('/');
		});
	} catch (error) {
		console.error('Błąd podczas logowania:', error);
		return res.status(500).render('500', { pageTitle: 'Błąd serwera' });
	}
};

// ** NOWA FUNKCJA: GET - wyświetlanie formularza weryfikacji 2FA przy logowaniu **
exports.getVerify2FALogin = async (req, res, next) => {
	if (!req.session.tmpUser) return res.redirect('/login');

	const user = await User.findById(req.session.tmpUser);
	if (!user) return res.redirect('/login');

	res.render('auth/verify-2fa-setup', {
		pageTitle: 'Weryfikacja 2FA',
		path: '/',
		errorMessage: null,
	});
};

// ** NOWA FUNKCJA: POST - weryfikacja kodu 2FA przy logowaniu **
exports.postVerify2FALogin = async (req, res, next) => {
	if (!req.session.tmpUser) return res.redirect('/login');

	const user = await User.findById(req.session.tmpUser);
	if (!user) return res.redirect('/login');
	const token = req.body.code.replace(/\s+/g, '');
	const verified = speakeasy.totp.verify({
		secret: user.twoFactorSecret,
		encoding: 'base32',
		token,
		window: 1,
	});

	if (!verified) {
		return res.status(401).render('auth/verify-2fa-setup', {
			pageTitle: 'Weryfikacja 2FA',
			errorMessage: 'Niepoprawny kod 2FA. Spróbuj ponownie.',
		});
	}

	// Kod 2FA poprawny, logujemy użytkownika
	req.session.isLoggedIn = true;
	req.session.user = user;
	delete req.session.tmpUser;
	req.session.save(() => {
		res.redirect('/');
	});
};

exports.getSignup = (req, res, next) => {
	res.render('auth/signup', {
		pageTitle: 'Rejestracja',
		path: '/signup',
		errorMessage: null,
		oldInput: {
			email: '',
			password: '',
			confirmPassword: '',
		},
		validationErrors: [],
	});
};

exports.postSignup = async (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	const hashedPassword = await bcrypt.hash(password, 12);
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(422).render('auth/signup', {
			pageTitle: 'Rejestracja',
			path: '/signup',
			errorMessage: errors.array()[0].msg,
			oldInput: {
				email,
				password,
				confirmPassword: req.body.confirmPassword,
			},
			validationErrors: errors.array(),
		});
	}

	const secret = speakeasy.generateSecret({ name: `TwójSklep (${email})` });
	const user = new User({
		email,
		password: hashedPassword,
		isAdmin: false,
		twoFactorSecret: secret.base32,
		twoFactorEnabled: false,
	});

	try {
		await user.save();
		req.session.tmpUser = user._id;
		return res.redirect('/verify-2fa-setup'); // ścieżka do aktywacji 2FA po rejestracji
	} catch (err) {
		const error = new Error(err);
		error.httpStatusCode = 500;
		return next(error);
	}
};

exports.postLogout = (req, res, next) => {
	req.session.destroy((err) => {
		if (err) {
			console.error('Błąd podczas wylogowywania:', err);
			return res.status(500).render('500', { pageTitle: 'Błąd serwera' });
		}
		res.redirect('/');
	});
};

exports.getProfile = (req, res, next) => {
	res.render('auth/profile', {
		pageTitle: 'Profil',
		path: '/profile',
		user: req.user,
		mail_message: null,
	});
};

exports.postResetPassword = async (req, res, next) => {
	const token = crypto.randomBytes(32).toString('hex');
	req.user.resetToken = token;
	await req.user.save();

	transporter.sendMail({
		to: req.user.email,
		from: process.env.GMAIL_USER,
		subject: 'Password reset',
		html: `
	        <p>You requested a password reset</p>
	        <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
	      `,
	});

	res.render('auth/profile', {
		pageTitle: 'Resetowanie hasła',
		path: '/profile',
		user: req.user,
		mail_message: 'Sprawdź swoją skrzynkę e-mail, aby zresetować hasło.',
	});
};

exports.getVerify2FASetup = async (req, res, next) => {
	if (!req.session.tmpUser) return res.redirect('/login');

	const user = await User.findById(req.session.tmpUser);
	console.log('2FA Secret:', user.twoFactorSecret);
	if (!user) return res.redirect('/login');

	const otpauth_url = speakeasy.otpauthURL({
		secret: user.twoFactorSecret,
		label: `TwójSklep (${user.email})`,
		encoding: 'base32',
	});
	console.log('otpauth URL:', otpauth_url);

	QRCode.toDataURL(otpauth_url, (err, data_url) => {
		if (err) return next(err);
		res.render('auth/verify-2fa-setup', {
			pageTitle: 'Aktywuj 2FA',
			qrCode: data_url,
			errorMessage: null,
			path: '/',
		});
	});
};

exports.postVerify2FASetup = async (req, res, next) => {
	if (!req.session.tmpUser) return res.redirect('/login');

	const user = await User.findById(req.session.tmpUser);
	if (!user) return res.redirect('/login');
	const token = req.body.code.replace(/\s+/g, '');
	const verified = speakeasy.totp.verify({
		secret: user.twoFactorSecret,
		encoding: 'base32',
		token,
		window: 2,
	});

	if (verified) {
		user.twoFactorEnabled = true;
		await user.save();

		req.session.user = user;
		req.session.isLoggedIn = true;
		delete req.session.tmpUser;
		return req.session.save(() => {
			res.redirect('/');
		});
	} else {
		const otpauth_url = speakeasy.otpauthURL({
			secret: user.twoFactorSecret,
			label: `TwójSklep (${user.email})`,
			encoding: 'base32',
		});

		QRCode.toDataURL(otpauth_url, (err, data_url) => {
			if (err) return next(err);
			return res.render('auth/verify-2fa-setup', {
				pageTitle: 'Aktywuj 2FA',
				qrCode: data_url,
				path: '/',
				errorMessage: 'Kod jest niepoprawny. Spróbuj ponownie.',
			});
		});
	}
};
