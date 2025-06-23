const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const User = require('./models/User');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const errorController = require('./controller/error');
const homeRoutes = require('./routes/home');
const cookieParser = require('cookie-parser');
//SESSION STORE IN MONGODB
const store = new MongoDBStore({
	uri: process.env.MONGODB_URI,
	collection: 'sessions',
});
const corsOptions = {
	origin: 'http://localhost:5173',
	credentials: true, // pozwala na ciasteczka
};

app.use(cors(corsOptions));
app.use(cookieParser());
//SESSION CONFIGURATION
app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
		saveUninitialized: false,
		store: store,
	})
);
//MIDDLEWARES for parsing request bodies and serving static files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

//SETTINGS FOR VIEW ENGINE 
app.set('view engine', 'ejs');
app.set('views', 'views');

// CSRF PROTECTION
const csrfProtection = csrf();
app.use(csrfProtection);

// MIDDLEWARES FOR AUTHENTICATION AND CSRF TOKEN GLOBALY
app.use((req, res, next) => {
	res.locals.isAuthenticated = req.session.isLoggedIn || false;
	res.locals.csrfToken = req.csrfToken();
	next();
});
app.use((req, res, next) => {
	res.cookie('XSRF-TOKEN', req.csrfToken(), {
		httpOnly: false, // Uwaga: musi być dostępne z Reacta, więc NIE httpOnly
		sameSite: 'Lax',
		secure: false, // ustaw true jeśli używasz HTTPS
	});
	next();
});
// MIDDLEWARE FOR USER AUTHENTICATION
app.use((req, res, next) => {
	if (!req.session.user) {
		return next();
	}

	User.findById(req.session.user._id).then((user) => {
		if (!user) {
			return next();
		}
		req.user = user;

		next();
	});
});
// ROUTES
app.use(homeRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// ERROR HANDLING ROUTES
app.use(errorController.get404);

// GLOBAL ERROR HANDLER
// app.use((error, req, res, next) => {
// 	res.status(500).render('errors/500', {
// 		pageTitle: 'Błąd serwera',
// 		path: '/500',
// 	});
// });
// CONNECT TO MONGODB AND START SERVER
mongoose
	.connect(process.env.MONGODB_URI)
	.then(async () => {
		app.listen(process.env.PORT || 3000);
	})
	.catch((err) => {
		console.error('MongoDB connection error:', err);
	});
