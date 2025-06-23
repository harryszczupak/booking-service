const express = require('express');
const router = express.Router();
router.get('/', (req, res) => {
	res.render('home', {
		pageTitle: 'Strona Główna',
		path: '/',
	});
});

module.exports = router;
