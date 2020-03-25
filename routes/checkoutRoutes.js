const express = require('express');

const { protect, restrictTo } = require('../controllers/authController');
const { checkCard, buyTour } = require('../controllers/checkoutController');
const {
  createBookingCheckoutPagarme
} = require('../controllers/bookingController');

const router = express.Router();

router.use(protect, restrictTo('user'));

router.route('/:tourId').post(checkCard, buyTour, createBookingCheckoutPagarme);

module.exports = router;
